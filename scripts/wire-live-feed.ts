import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { FEED_ID, RISK, SOURCE_ROSTER } from "./config";

/**
 * Reconciles the XAU/USD feed on-chain with the sources the keeper actually
 * runs, so every label tells the truth.
 *
 *   npx hardhat run scripts/wire-live-feed.ts --network bscTestnet
 *
 * Three things happen:
 *
 *  1. Any source whose on-chain name does not correspond to a real adapter is
 *     deactivated. The feed was bootstrapped with a placeholder "MM Desk RFQ"
 *     before a desk existed; leaving it live would attribute CEX data to a
 *     market maker that is not there.
 *
 *  2. The Pyth and Gate.io reporters are registered.
 *
 *  3. minDepth is set to 0. Depth gating only makes sense for venues that quote
 *     size; an oracle publishes a reference, not an order book, and reports 0
 *     rather than inventing a figure. Every source still publishes its true
 *     depth on-chain, so the numbers remain public and auditable — freshness,
 *     spread, deviation and cross-kind agreement carry the gating.
 */

const KINDS = ["MM_QUOTE", "CEX", "DEX", "ORACLE", "NAV"];

// Reporter key -> the identity it publishes under, from the shared roster.
const WANTED = SOURCE_ROSTER.map((r) => ({ keyEnv: r.keyEnv, kind: r.kind, name: r.name }));

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`deploy to ${network.name} first`);
  const book = JSON.parse(fs.readFileSync(file, "utf8"));

  const engine = await ethers.getContractAt("PriceValidationEngine", book.contracts.PriceValidationEngine);

  // Roster entries without a configured key are simply not part of this
  // deployment — skip them rather than refusing to run, so a network can carry a
  // subset of the sources.
  const wanted = WANTED.filter((w) => {
    if (process.env[w.keyEnv]) return true;
    console.log(`skip        ${w.name} — ${w.keyEnv} not set on this network`);
    return false;
  }).map((w) => ({ ...w, address: new ethers.Wallet(process.env[w.keyEnv]!).address }));
  const wantedSet = new Set(wanted.map((w) => w.address.toLowerCase()));

  console.log(`\nfeed ${FEED_ID} on ${network.name}\n`);

  const existing = await engine.getSources(FEED_ID);
  console.log("current sources:");
  for (const s of existing) {
    console.log(`  ${s.active ? "active  " : "inactive"} ${s.reporter}  ${KINDS[Number(s.kind)].padEnd(8)} "${s.name}"`);
  }

  // 1. Retire placeholders that no adapter drives.
  console.log();
  for (const s of existing) {
    if (s.active && !wantedSet.has(s.reporter.toLowerCase())) {
      const tx = await engine.setSourceActive(FEED_ID, s.reporter, false);
      await tx.wait();
      console.log(`deactivated "${s.name}" (no real adapter behind it)`);
      console.log(`  ${book.explorer}/tx/${tx.hash}`);
    }
  }

  // 2. Register the sources the keeper drives.
  for (const w of wanted) {
    const already = existing.find((s: any) => s.reporter.toLowerCase() === w.address.toLowerCase());
    if (already) {
      if (Number(already.kind) !== w.kind) {
        console.warn(
          `!! ${w.name} is registered as ${KINDS[Number(already.kind)]} but the adapter is ` +
            `${KINDS[w.kind]}. A source's kind cannot be changed — deactivate and re-add ` +
            `under a fresh key if this matters.`
        );
      }
      if (!already.active) {
        const tx = await engine.setSourceActive(FEED_ID, w.address, true);
        await tx.wait();
        console.log(`reactivated ${w.name}`);
      } else {
        console.log(`ok          ${w.name} already active`);
      }
      continue;
    }
    const tx = await engine.addSource(FEED_ID, w.address, w.kind, w.name);
    await tx.wait();
    console.log(`added       ${w.name} (${KINDS[w.kind]}) ${w.address}`);
    console.log(`  ${book.explorer}/tx/${tx.hash}`);
  }

  // 3. Depth gating off for this feed; see the note at the top of the file.
  const [, risk] = await engine.getFeed(FEED_ID);
  if (risk.minDepth !== 0n) {
    const tx = await engine.setRiskConfig(FEED_ID, { ...RISK, minDepth: 0n });
    await tx.wait();
    console.log(`\nminDepth ${ethers.formatEther(risk.minDepth)} -> 0 (oracle sources carry no book)`);
    console.log(`  ${book.explorer}/tx/${tx.hash}`);
  }

  const final = await engine.getSources(FEED_ID);
  const live = final.filter((s: any) => s.active);
  const kinds = new Set(live.map((s: any) => Number(s.kind)));
  const [, r2] = await engine.getFeed(FEED_ID);

  console.log(`\nresult: ${live.length} active sources across ${kinds.size} kinds`);
  for (const s of live) console.log(`  ${KINDS[Number(s.kind)].padEnd(8)} "${s.name}"  ${s.reporter}`);
  console.log(
    `\nrequires minSources=${r2.minSources}, minDistinctKinds=${r2.minDistinctKinds} -> ` +
      `${live.length >= Number(r2.minSources) && kinds.size >= Number(r2.minDistinctKinds) ? "SATISFIED" : "NOT SATISFIED"}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
