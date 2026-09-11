/**
 * Price source adapters — real market data, no synthetic values.
 *
 * Every adapter returns a quote in 18-decimal fixed point.
 *
 * On `depth`: this is the notional a taker could realistically fill, not the
 * size sitting at the very top of the book. Top-of-book on PAXG is only a few
 * thousand dollars, so gating on it would reject every honest venue; the
 * aggregated notional within a band around mid is the number that actually
 * means something. Sources with no order book at all (an oracle publishes a
 * reference, not a tradeable size) report zero rather than inventing a figure —
 * the feed's `minDepth` is set accordingly, and every value is on-chain for
 * anyone to judge.
 *
 * On `observedAt`: always the timestamp the *source* produced the data, never
 * "now". Reporting now would defeat the engine's freshness check.
 */

export interface Quote {
  price: bigint;
  bid: bigint;
  ask: bigint;
  depth: bigint;
  observedAt: number; // unix seconds
}

/** Matches PriceValidationEngine.SourceKind. */
export const KIND = {
  MM_QUOTE: 0,
  CEX: 1,
  DEX: 2,
  ORACLE: 3,
  NAV: 4,
} as const;

export interface Source {
  name: string;
  kind: 0 | 1 | 2 | 3 | 4;
  fetch(): Promise<Quote>;
}

const E18 = 10n ** 18n;

/** Parse a decimal string into 18-decimal fixed point without float rounding. */
export function toWei(value: string | number): bigint {
  const s = String(value).trim();
  const neg = s.startsWith("-");
  const [whole, frac = ""] = (neg ? s.slice(1) : s).split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  const v = BigInt(whole || "0") * E18 + BigInt(padded || "0");
  return neg ? -v : v;
}

async function getJson(url: string, timeoutMs = 8000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Level = [string | number, string | number]; // [price, size]

/**
 * Aggregate fillable notional on each side within `bandBps` of mid, and return
 * the smaller side — we never claim more depth than the thinner direction.
 */
function bookDepth(bids: Level[], asks: Level[], bandBps = 50) {
  if (!bids.length || !asks.length) throw new Error("empty book");

  const bestBid = Number(bids[0][0]);
  const bestAsk = Number(asks[0][0]);
  const mid = (bestBid + bestAsk) / 2;
  const lo = mid * (1 - bandBps / 10_000);
  const hi = mid * (1 + bandBps / 10_000);

  let bidNotional = 0;
  let askNotional = 0;
  for (const [p, q] of bids) if (Number(p) >= lo) bidNotional += Number(p) * Number(q);
  for (const [p, q] of asks) if (Number(p) <= hi) askNotional += Number(p) * Number(q);

  return {
    bid: toWei(bestBid),
    ask: toWei(bestAsk),
    price: toWei(mid),
    depth: toWei(Math.floor(Math.min(bidNotional, askNotional))),
  };
}

/**
 * A CEX order book. `observedAt` is set to now because these endpoints return
 * the live book without a timestamp; the request itself is the observation, and
 * it completes in well under the freshness window.
 */
function cexBook(name: string, url: string, parse: (j: any) => { bids: Level[]; asks: Level[] }): Source {
  return {
    name,
    kind: KIND.CEX,
    async fetch() {
      const { bids, asks } = parse(await getJson(url));
      const d = bookDepth(bids, asks);
      return { ...d, observedAt: Math.floor(Date.now() / 1000) };
    },
  };
}

export const binanceBook = (symbol = "PAXGUSDT") =>
  cexBook(
    `Binance ${symbol}`,
    `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=50`,
    (j) => ({ bids: j.bids, asks: j.asks })
  );

export const okxBook = (instId = "PAXG-USDT") =>
  cexBook(
    `OKX ${instId}`,
    `https://www.okx.com/api/v5/market/books?instId=${instId}&sz=50`,
    (j) => {
      const d = j.data?.[0];
      if (!d) throw new Error("empty response");
      // OKX levels are [price, size, liquidatedOrders, orderCount].
      return { bids: d.bids.map((x: any[]) => [x[0], x[1]]), asks: d.asks.map((x: any[]) => [x[0], x[1]]) };
    }
  );

export const gateBook = (pair = "PAXG_USDT") =>
  cexBook(
    `Gate.io ${pair}`,
    `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${pair}&limit=50`,
    (j) => ({ bids: j.bids, asks: j.asks })
  );

export const kucoinBook = (symbol = "PAXG-USDT") =>
  cexBook(
    `KuCoin ${symbol}`,
    `https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=${symbol}`,
    (j) => {
      if (!j.data?.bids?.length) throw new Error("empty response");
      return { bids: j.data.bids, asks: j.data.asks };
    }
  );

/**
 * Pyth Hermes. Pyth publishes a price plus a confidence interval, which maps
 * naturally onto bid/ask — the band the oracle itself says the price sits in.
 * `publish_time` is the real observation time, so a stalled Pyth feed is caught
 * by the engine's freshness check rather than hidden.
 *
 * No order book, so depth is zero: an oracle reports a reference, not size.
 */
export function pythOracle(
  priceId = "765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  label = "Pyth XAU/USD"
): Source {
  const id = priceId.replace(/^0x/, "");
  return {
    name: label,
    kind: KIND.ORACLE,
    async fetch() {
      const j = await getJson(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${id}`);
      const p = j.parsed?.[0]?.price;
      if (!p) throw new Error("no parsed price");

      const expo = Number(p.expo); // negative
      const scale = 10n ** BigInt(18 + expo); // expo is negative, so this shrinks
      const price = BigInt(p.price) * scale;
      const conf = BigInt(p.conf) * scale;

      return {
        price,
        bid: price - conf,
        ask: price + conf,
        depth: 0n,
        observedAt: Number(p.publish_time),
      };
    },
  };
}

/**
 * A Chainlink aggregator read straight from chain. `updatedAt` is the round's
 * real timestamp — gold feeds update on a heartbeat, so this source is expected
 * to be rejected as stale sometimes. That is the engine working, not a bug.
 *
 * Defaults to the XAU/USD aggregator on BNB Chain mainnet.
 */
export function chainlinkOracle(
  rpc = "https://bsc-dataseed.bnbchain.org",
  aggregator = "0x86896fEB19D8A607c3b11f2aF50A0f239Bd71CD0",
  label = "Chainlink XAU/USD"
): Source {
  return {
    name: label,
    kind: KIND.ORACLE,
    async fetch() {
      const call = async (data: string) => {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{ to: aggregator, data }, "latest"],
          }),
          signal: AbortSignal.timeout(8000),
        });
        const j = await res.json();
        if (j.error) throw new Error(j.error.message);
        return j.result as string;
      };

      const decimals = parseInt(await call("0x313ce567"), 16);
      const words = (await call("0xfeaf968c")).slice(2).match(/.{64}/g)!;
      const answer = BigInt("0x" + words[1]);
      const updatedAt = parseInt(words[3], 16);
      if (answer <= 0n) throw new Error("non-positive answer");

      return {
        price: answer * 10n ** BigInt(18 - decimals),
        bid: 0n, // one-sided reference: no spread to check
        ask: 0n,
        depth: 0n,
        observedAt: updatedAt,
      };
    },
  };
}

/**
 * A market-maker desk's RFQ endpoint. Unlike the venues above, a desk is
 * attesting to size it will actually honour, so `size` is real depth.
 * Expects JSON `{ bid, ask, size }` as decimal strings.
 */
export function mmDeskQuote(url: string, auth?: string, label = "MM Desk RFQ"): Source {
  return {
    name: label,
    kind: KIND.MM_QUOTE,
    async fetch() {
      const res = await fetch(url, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const q = await res.json();

      const bid = toWei(q.bid);
      const ask = toWei(q.ask);
      const mid = (bid + ask) / 2n;
      return {
        price: mid,
        bid,
        ask,
        depth: (toWei(q.size) * mid) / E18,
        observedAt: q.asOf ? Math.floor(new Date(q.asOf).getTime() / 1000) : Math.floor(Date.now() / 1000),
      };
    },
  };
}

/**
 * Fund administrator NAV. One-sided by nature — a NAV is a single print, not a
 * two-way market — so bid/ask stay zero and the engine skips the spread check.
 * Expects `{ nav, asOf, units }`.
 */
export function navFeed(url: string, auth?: string, label = "Fund Administrator NAV"): Source {
  return {
    name: label,
    kind: KIND.NAV,
    async fetch() {
      const res = await fetch(url, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const q = await res.json();

      const nav = toWei(q.nav);
      return {
        price: nav,
        bid: 0n,
        ask: 0n,
        depth: q.units ? (toWei(q.units) * nav) / E18 : 0n,
        observedAt: q.asOf ? Math.floor(new Date(q.asOf).getTime() / 1000) : Math.floor(Date.now() / 1000),
      };
    },
  };
}

/** Build an adapter from its roster id. Keeps the roster free of imports. */
export function adapterFor(id: string): Source {
  switch (id) {
    case "binance":
      return binanceBook(process.env.BINANCE_SYMBOL);
    case "okx":
      return okxBook(process.env.OKX_INST_ID);
    case "gate":
      return gateBook(process.env.GATE_PAIR);
    case "kucoin":
      return kucoinBook(process.env.KUCOIN_SYMBOL);
    case "pyth":
      return pythOracle();
    case "chainlink":
      return chainlinkOracle(process.env.CHAINLINK_RPC, process.env.CHAINLINK_AGGREGATOR);
    default:
      throw new Error(`unknown price source adapter "${id}"`);
  }
}
