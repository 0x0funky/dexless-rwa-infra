import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { loadEnv } from "../scripts/env";
import { SOURCE_ROSTER } from "../scripts/config";
import {
  adapterFor,
  chainlinkOracle,
  kucoinBook,
  mmDeskQuote,
  navFeed,
  Source,
} from "./sources";

loadEnv();

/**
 * DEXless pricing keeper.
 *
 * Polls every configured source for real market data, writes each observation
 * to PriceValidationEngine under that source's own key, then triggers a
 * validation round. This process is the product's data pipeline — the
 * transactions it sends are the protocol operating, not test traffic.
 *
 *   npm run keeper
 *
 * Each source signs with its own key. Sharing one key across sources would make
 * the cross-source consistency check meaningless, so the keeper refuses to run
 * a source whose key is missing, and warns about any source that is not
 * registered and active on the feed.
 */

const ENGINE_ABI = [
  "function submitQuote(bytes32,uint256,uint256,uint256,uint256,uint64)",
  "function validate(bytes32) returns (bool)",
  "function peekPrice(bytes32) view returns (uint256,uint64,uint8,bool,bool)",
  "function validationCount(bytes32) view returns (uint64)",
  "function getSources(bytes32) view returns (tuple(uint8 kind,bool active,address reporter,string name)[])",
  "event PriceValidated(bytes32 indexed feedId,uint256 price,uint8 sourceCount,uint8 distinctKinds,uint64 validatedAt)",
  "event ValidationFailed(bytes32 indexed feedId,uint8 indexed reason,uint8 survivors)",
  "event SourceRejected(bytes32 indexed feedId,address indexed reporter,uint8 indexed reason)",
  "event FeedPaused(bytes32 indexed feedId,string reason)",
];

const REJECT_REASON = [
  "None", "No quote", "Stale", "Spread too wide", "Insufficient depth", "Deviation exceeded",
];
const FAILURE_REASON = ["None", "Too few sources", "Too few source kinds"];

const FEED_ID = process.env.FEED_ID || ethers.keccak256(ethers.toUtf8Bytes("XAU/USD"));
const INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS ?? 300_000);
const NETWORK = process.env.KEEPER_NETWORK ?? "bscTestnet";
const E18 = 10n ** 18n;

/**
 * Which source each reporter key drives.
 *
 * The base roster lives in scripts/config.ts and is shared with the business
 * flow and the feed-wiring script: a source's on-chain name and kind are
 * immutable once registered, so a second copy of this list would eventually
 * drift and put a permanently wrong label on a live feed.
 */
function sourceRoster(): { keyEnv: string; source: Source }[] {
  const roster: { keyEnv: string; source: Source }[] = SOURCE_ROSTER.map((r) => ({
    keyEnv: r.keyEnv,
    source: adapterFor(r.adapter),
  }));

  if (process.env.KUCOIN_ENABLED === "true") {
    roster.push({ keyEnv: "REPORTER_KEY_5", source: kucoinBook(process.env.KUCOIN_SYMBOL) });
  }
  if (process.env.CHAINLINK_ENABLED === "true") {
    roster.push({
      keyEnv: "REPORTER_KEY_6",
      source: chainlinkOracle(process.env.CHAINLINK_RPC, process.env.CHAINLINK_AGGREGATOR),
    });
  }
  if (process.env.MM_QUOTE_URL) {
    roster.push({
      keyEnv: "REPORTER_KEY_MM",
      source: mmDeskQuote(process.env.MM_QUOTE_URL, process.env.MM_QUOTE_AUTH),
    });
  }
  if (process.env.NAV_FEED_URL) {
    roster.push({
      keyEnv: "REPORTER_KEY_NAV",
      source: navFeed(process.env.NAV_FEED_URL, process.env.NAV_FEED_AUTH),
    });
  }
  return roster;
}

function loadEngineAddress(): string {
  if (process.env.ENGINE_ADDRESS) return process.env.ENGINE_ADDRESS;
  const file = path.join(__dirname, "..", "deployments", `${NETWORK}.json`);
  if (!fs.existsSync(file)) throw new Error(`set ENGINE_ADDRESS or deploy to ${NETWORK} first`);
  return JSON.parse(fs.readFileSync(file, "utf8")).contracts.PriceValidationEngine;
}

const fmt = (v: bigint, d = 2) => {
  const w = v / E18;
  const f = (v % E18) / 10n ** BigInt(18 - d);
  return `${w}.${f.toString().padStart(d, "0")}`;
};

async function main() {
  const rpc =
    process.env.BSC_RPC_KEEPER ??
    (NETWORK === "bsc"
      ? process.env.BSC_RPC ?? "https://bsc-dataseed.bnbchain.org"
      : process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545");

  const provider = new ethers.JsonRpcProvider(rpc);
  const engineAddress = loadEngineAddress();
  const engine = new ethers.Contract(engineAddress, ENGINE_ABI, provider);

  // Pair each source with its signer, dropping any whose key is absent.
  const roster = sourceRoster();
  const active: { source: Source; signer: ethers.Wallet }[] = [];
  for (const r of roster) {
    const key = process.env[r.keyEnv];
    if (!key) {
      console.warn(`  skip ${r.source.name} — ${r.keyEnv} not set`);
      continue;
    }
    active.push({ source: r.source, signer: new ethers.Wallet(key, provider) });
  }
  if (active.length === 0) throw new Error("no reporter keys configured");

  console.log(`keeper starting`);
  console.log(`  network  ${NETWORK} (${rpc})`);
  console.log(`  engine   ${engineAddress}`);
  console.log(`  feed     ${FEED_ID}`);
  console.log(`  interval ${INTERVAL_MS / 1000}s\n`);

  // Every source must be registered and active on-chain, or its quotes revert.
  const registered = await engine.getSources(FEED_ID);
  const KINDS = ["MM_QUOTE", "CEX", "DEX", "ORACLE", "NAV"];
  for (const a of active) {
    const match = registered.find(
      (r: any) => r.reporter.toLowerCase() === a.signer.address.toLowerCase()
    );
    const bal = await provider.getBalance(a.signer.address);
    const state = !match
      ? "NOT REGISTERED"
      : !match.active
        ? "INACTIVE"
        : `on-chain "${match.name}" (${KINDS[Number(match.kind)]})`;

    console.log(`  ${a.source.name.padEnd(22)} ${a.signer.address}  ${ethers.formatEther(bal)} BNB`);
    console.log(`    ${state}`);

    if (match && match.active && Number(match.kind) !== a.source.kind) {
      console.warn(
        `    !! kind mismatch: on-chain says ${KINDS[Number(match.kind)]}, ` +
          `adapter is ${KINDS[a.source.kind]} — the label would be wrong`
      );
    }
    if (bal < ethers.parseEther("0.005")) {
      console.warn(`    !! low balance, top up before it stalls`);
    }
  }
  console.log();

  let round = 0;
  const tick = async () => {
    round++;
    console.log(`\n[${new Date().toISOString()}] round ${round}`);

    let submitted = 0;
    for (const { source, signer } of active) {
      try {
        const q = await source.fetch();
        const tx = await (engine.connect(signer) as any).submitQuote(
          FEED_ID, q.price, q.bid, q.ask, q.depth, q.observedAt
        );
        await tx.wait();
        submitted++;
        const age = Math.floor(Date.now() / 1000) - q.observedAt;
        console.log(
          `  ${source.name.padEnd(22)} ${fmt(q.price).padStart(9)}  ` +
            `depth $${fmt(q.depth, 0).padStart(8)}  age ${String(age).padStart(3)}s  ${tx.hash.slice(0, 12)}…`
        );
      } catch (e: any) {
        // One bad source must never stop the round — absorbing that is exactly
        // what the validation engine exists to do.
        console.error(`  ${source.name.padEnd(22)} FAILED: ${String(e.message ?? e).split("\n")[0].slice(0, 70)}`);
      }
    }

    if (submitted === 0) {
      console.error("  no sources responded — skipping validation");
      return;
    }

    try {
      const tx = await (engine.connect(active[0].signer) as any).validate(FEED_ID);
      const receipt = await tx.wait();
      const events = receipt.logs
        .map((l: any) => { try { return engine.interface.parseLog(l); } catch { return null; } })
        .filter(Boolean);

      for (const ev of events) {
        if (ev.name === "SourceRejected") {
          const who = registered.find(
            (r: any) => r.reporter.toLowerCase() === ev.args.reporter.toLowerCase()
          );
          console.log(
            `  -> rejected ${who?.name ?? ev.args.reporter}: ${REJECT_REASON[Number(ev.args.reason)]}`
          );
        }
      }

      const ok = events.find((e: any) => e.name === "PriceValidated");
      const bad = events.find((e: any) => e.name === "ValidationFailed");
      const paused = events.find((e: any) => e.name === "FeedPaused");

      if (ok) {
        console.log(
          `  => VALIDATED ${fmt(ok.args.price)} from ${ok.args.sourceCount} sources / ` +
            `${ok.args.distinctKinds} kinds   ${tx.hash.slice(0, 12)}…`
        );
      } else if (bad) {
        console.warn(
          `  => ROUND FAILED ${FAILURE_REASON[Number(bad.args.reason)]} ` +
            `(${bad.args.survivors} survived)   ${tx.hash.slice(0, 12)}…`
        );
      }
      if (paused) console.error(`  => FEED PAUSED — investigate before resuming`);
    } catch (e: any) {
      console.error(`  validate() failed: ${String(e.message ?? e).split("\n")[0].slice(0, 90)}`);
    }
  };

  await tick();
  setInterval(tick, INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
