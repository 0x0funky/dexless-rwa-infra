import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { loadEnv } from "./env";
import { SOURCE_ROSTER } from "./config";

loadEnv();

/**
 * Summarises on-chain activity: protocol counters, which addresses transacted,
 * and which events fired. Read-only.
 *
 *   npx hardhat run scripts/onchain-report.ts --network bscTestnet
 *   WINDOW=100000 npx hardhat run scripts/onchain-report.ts --network bsc
 *
 * Writes `docs/onchain-activity.md` — submission material #5 (鏈上交互數據).
 *
 * Two independent sources of truth, deliberately:
 *
 *   - Transaction counts come from each wallet's *nonce*. Exact, instant, and
 *     immune to RPC log limits.
 *   - Event counts come from getLogs, which public RPCs rate-limit hard over
 *     wide ranges. Any chunk that fails is counted, and a partial scan is
 *     labelled as partial rather than reported as zero — a submission document
 *     claiming "0 transactions" because a scan was throttled would be worse
 *     than no document at all.
 */

const CHUNK = 5_000;
const DEFAULT_WINDOW = 50_000; // blocks back from head unless told otherwise

const CONTRACTS = [
  "PriceValidationEngine",
  "MarketFactory",
  "RWAAssetRegistry",
  "ComplianceRegistry",
  "RWAToken",
  "FeeDistributor",
] as const;

/**
 * Project-operated wallets, labelled honestly by what they actually are.
 * Price sources come from the shared roster so a newly added source cannot be
 * left out of the count.
 */
const PROJECT_WALLETS: { key: string; label: string; nature: string }[] = [
  { key: "DEPLOYER_PRIVATE_KEY", label: "Operator / deployer", nature: "infrastructure" },
  { key: "REPORTER_KEY_0", label: "Retired source slot", nature: "infrastructure" },
  ...SOURCE_ROSTER.map((r) => ({
    key: r.keyEnv,
    label: `Price source — ${r.name}`,
    nature: "infrastructure",
  })),
  { key: "INVESTOR_KEY_0", label: "Test participant 1", nature: "project-operated" },
  { key: "INVESTOR_KEY_1", label: "Test participant 2", nature: "project-operated" },
  { key: "INVESTOR_KEY_2", label: "Test participant 3", nature: "project-operated" },
];

interface ScanResult {
  events: Map<string, number>;
  txHashes: Set<string>;
  recent: { block: number; contract: string; event: string; hash: string }[];
  chunksTried: number;
  chunksFailed: number;
}

async function scanContract(name: string, address: string, from: number, to: number): Promise<ScanResult> {
  const c = await ethers.getContractAt(name, address);
  const r: ScanResult = {
    events: new Map(),
    txHashes: new Set(),
    recent: [],
    chunksTried: 0,
    chunksFailed: 0,
  };

  for (let start = from; start <= to; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, to);
    r.chunksTried++;

    let logs: any[] | null = null;
    for (let attempt = 0; attempt < 3 && logs === null; attempt++) {
      try {
        logs = await ethers.provider.getLogs({ address, fromBlock: start, toBlock: end });
      } catch (e: any) {
        if (attempt === 2) break;
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
    if (logs === null) {
      r.chunksFailed++;
      continue;
    }

    for (const log of logs) {
      let parsed;
      try {
        parsed = c.interface.parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;
      r.events.set(parsed.name, (r.events.get(parsed.name) ?? 0) + 1);
      r.txHashes.add(log.transactionHash);
      r.recent.push({ block: log.blockNumber, contract: name, event: parsed.name, hash: log.transactionHash });
    }
  }
  return r;
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`no deployment for ${network.name}`);
  const book = JSON.parse(fs.readFileSync(file, "utf8"));

  const latest = await ethers.provider.getBlockNumber();
  const window = Number(process.env.WINDOW ?? DEFAULT_WINDOW);
  const from = process.env.FROM_BLOCK
    ? Number(process.env.FROM_BLOCK)
    : Math.max(book.deployBlock ?? 0, latest - window);
  const fullHistory = from <= (book.deployBlock ?? 0);

  console.log(`\nDEXless on-chain activity — ${network.name}`);
  console.log(`event scan: blocks ${from}..${latest} (${latest - from} blocks)`);
  if (!fullHistory) {
    console.log(`  note: this is a recent window, not all history since deployment`);
    console.log(`  for the full range: FROM_BLOCK=${book.deployBlock} (slow on a public RPC)`);
  }
  console.log();

  // ── Transactions per wallet, from nonces. Exact and instant. ──────────
  const wallets: { label: string; nature: string; address: string; txCount: number }[] = [];
  for (const w of PROJECT_WALLETS) {
    const key = process.env[w.key];
    if (!key) continue;
    const address = new ethers.Wallet(key).address;
    const txCount = await ethers.provider.getTransactionCount(address);
    wallets.push({ label: w.label, nature: w.nature, address, txCount });
  }
  const totalTx = wallets.reduce((a, w) => a + w.txCount, 0);
  const activeWallets = wallets.filter((w) => w.txCount > 0);

  // ── Events. May be partial; that is tracked and reported. ─────────────
  const allEvents: { contract: string; event: string; count: number }[] = [];
  const recent: ScanResult["recent"] = [];
  let tried = 0;
  let failed = 0;

  for (const name of CONTRACTS) {
    const address = book.contracts[name];
    if (!address) continue;
    process.stdout.write(`  scanning ${name.padEnd(22)} `);
    const r = await scanContract(name, address, from, latest);
    tried += r.chunksTried;
    failed += r.chunksFailed;
    for (const [event, count] of r.events) allEvents.push({ contract: name, event, count });
    recent.push(...r.recent);
    console.log(
      `${[...r.events.values()].reduce((a, b) => a + b, 0)} events` +
        (r.chunksFailed ? `  (${r.chunksFailed}/${r.chunksTried} chunks unavailable)` : "")
    );
  }

  const coverage = tried === 0 ? 0 : Math.round(((tried - failed) / tried) * 100);
  const eventsComplete = failed === 0 && fullHistory;

  // ── Protocol counters. Direct reads; always exact. ────────────────────
  const engine = await ethers.getContractAt("PriceValidationEngine", book.contracts.PriceValidationEngine);
  const factory = await ethers.getContractAt("MarketFactory", book.contracts.MarketFactory);
  const assets = await ethers.getContractAt("RWAAssetRegistry", book.contracts.RWAAssetRegistry);
  const compliance = await ethers.getContractAt("ComplianceRegistry", book.contracts.ComplianceRegistry);
  const token = await ethers.getContractAt("RWAToken", book.contracts.RWAToken);

  const counters = {
    validations: await engine.totalValidations(),
    quotes: await engine.totalQuotesSubmitted(),
    feeds: await engine.feedCount(),
    markets: await factory.marketCount(),
    activeMarkets: await factory.activeMarkets(),
    assets: await assets.assetCount(),
    attested: await compliance.totalAttested(),
    supply: await token.totalSupply(),
  };

  console.log(`\nprotocol counters (exact)`);
  console.log(`  validation rounds  ${counters.validations}`);
  console.log(`  quotes submitted   ${counters.quotes}`);
  console.log(`  price feeds        ${counters.feeds}`);
  console.log(`  assets registered  ${counters.assets}`);
  console.log(`  markets            ${counters.markets} (${counters.activeMarkets} active)`);
  console.log(`  attested addresses ${counters.attested}`);
  console.log(`  token supply       ${ethers.formatEther(counters.supply)}`);

  console.log(`\ntransactions (from nonces, exact)`);
  console.log(`  ${totalTx} transactions from ${activeWallets.length} project wallets`);
  for (const w of wallets) {
    console.log(`  ${String(w.txCount).padStart(5)}  ${w.label.padEnd(24)} ${w.address}  [${w.nature}]`);
  }

  console.log(`\nevent scan coverage: ${coverage}%${eventsComplete ? "" : "  (PARTIAL)"}`);

  // ── Markdown ──────────────────────────────────────────────────────────
  recent.sort((a, b) => b.block - a.block);
  const eventRows = allEvents.sort((a, b) => b.count - a.count);

  const caveat = eventsComplete
    ? ""
    : `> **Note on event counts.** This scan covered blocks ${from}–${latest} at ${coverage}% chunk\n` +
      `> coverage${fullHistory ? "" : " and does not reach back to deployment"}. Event totals below are therefore a **lower bound**.\n` +
      `> Transaction counts and protocol counters above are exact — they come from wallet\n` +
      `> nonces and direct contract reads, not from log queries.\n\n`;

  const md =
    `# DEXless — On-Chain Activity\n\n` +
    `Network **${book.network}** (chainId ${book.chainId})\n` +
    `Contracts deployed at block ${book.deployBlock ?? "n/a"} · report generated ${new Date().toISOString()}\n\n` +
    caveat +
    `## Protocol state\n\n| Metric | Value |\n| --- | --- |\n` +
    `| Validation rounds | ${counters.validations} |\n` +
    `| Quotes submitted | ${counters.quotes} |\n` +
    `| Price feeds | ${counters.feeds} |\n` +
    `| Assets registered | ${counters.assets} |\n` +
    `| Markets | ${counters.markets} (${counters.activeMarkets} active) |\n` +
    `| Attested addresses | ${counters.attested} |\n` +
    `| RWA token supply | ${ethers.formatEther(counters.supply)} |\n` +
    `| **Transactions from project wallets** | **${totalTx}** |\n\n` +
    `## Contracts\n\n| Contract | Address |\n| --- | --- |\n` +
    CONTRACTS.map(
      (n) => `| ${n} | [\`${book.contracts[n]}\`](${book.explorer}/address/${book.contracts[n]}) |`
    ).join("\n") +
    `\n\n## Project-operated wallets\n\n` +
    `Infrastructure wallets run the pricing pipeline — every protocol operates its own\n` +
    `data nodes, and these publish real market data from Binance, OKX, Gate.io and Pyth.\n` +
    `Wallets marked *project-operated* were used to exercise flows during testing and are\n` +
    `**not** independent users.\n\n` +
    `| Transactions | Role | Address | Nature |\n| --- | --- | --- | --- |\n` +
    wallets
      .map(
        (w) =>
          `| ${w.txCount} | ${w.label} | [\`${w.address}\`](${book.explorer}/address/${w.address}) | ${w.nature} |`
      )
      .join("\n") +
    `\n\n## Events observed\n\n| Count | Contract | Event |\n| --- | --- | --- |\n` +
    (eventRows.length
      ? eventRows.map((r) => `| ${r.count} | ${r.contract} | \`${r.event}\` |`).join("\n")
      : `| — | — | *(no events in the scanned window)* |`) +
    `\n\n## Recent activity\n\n| Block | Contract | Event | Tx |\n| --- | --- | --- | --- |\n` +
    (recent.length
      ? recent
          .slice(0, 30)
          .map(
            (r) =>
              `| ${r.block} | ${r.contract} | \`${r.event}\` | [\`${r.hash.slice(0, 12)}…\`](${book.explorer}/tx/${r.hash}) |`
          )
          .join("\n")
      : `| — | — | — | *(none in the scanned window)* |`) +
    `\n`;

  const out = path.join(__dirname, "..", "docs", `onchain-activity-${book.network}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  console.log(`\nwritten to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
