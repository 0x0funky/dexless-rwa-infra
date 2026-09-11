import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { Wallet } from "ethers";
import { RISK } from "./config";

/**
 * Live demo toolkit. Each act is a separate command so it can be run in front of
 * an audience, one step at a time, with BscScan open alongside.
 *
 *   npx hardhat run scripts/demo-scenario.ts --network bscTestnet     (status)
 *   DEMO=setup    npx hardhat run scripts/demo-scenario.ts --network bscTestnet
 *   DEMO=spoof    npx hardhat run scripts/demo-scenario.ts --network bscTestnet
 *   DEMO=propose  npx hardhat run scripts/demo-scenario.ts --network bscTestnet
 *   DEMO=activate npx hardhat run scripts/demo-scenario.ts --network bscTestnet
 *   DEMO=tick     npx hardhat run scripts/demo-scenario.ts --network bscTestnet
 *
 * The acts, and what each one proves:
 *
 *   setup     Registers a second asset (silver) and its feed, so there is a
 *             market to create live. Uses the operator's roles.
 *   spoof     One of four sources publishes a price ~40% off. It is dropped as a
 *             deviation outlier and the round still validates from the honest
 *             survivors. -> "one bad actor cannot move the price"
 *   spoof2    TWO sources are manipulated, pushing survivors below minSources.
 *             The engine publishes nothing at all. -> "it fails safe"
 *   propose   Proposes the market from an INVESTOR wallet that holds no roles
 *             whatsoever. -> "anyone can list; nobody approves"
 *   activate  Activates from a *different* wallet than the proposer.
 *             -> "the contract decides, not a committee"
 *   tick      One ordinary validation round, to advance seasoning.
 */

const E18 = 10n ** 18n;

const ASSET2_ID = ethers.keccak256(ethers.toUtf8Bytes("DEXLESS-XAG-01"));
const FEED2_ID = ethers.keccak256(ethers.toUtf8Bytes("XAG/USD"));
const SILVER_BASE = 31n * E18; // ~$31/oz

const MARKET2_CONFIG = {
  maxLeverage: 5n,
  initialMarginBps: 2000n,
  maintenanceMarginBps: 1000n,
  tickSize: 10n ** 15n, // 0.001
  minOrderSize: E18 / 10n,
  orderlySymbol: "PERP_XAG_USDC",
};

function loadBook() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`deploy to ${network.name} first`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function wallets() {
  const reporters = [0, 1, 2, 3]
    .map((i) => process.env[`REPORTER_KEY_${i}`])
    .filter((k): k is string => Boolean(k))
    .map((k) => new ethers.Wallet(k, ethers.provider));

  const investors = [0, 1, 2]
    .map((i) => process.env[`INVESTOR_KEY_${i}`])
    .filter((k): k is string => Boolean(k))
    .map((k) => new ethers.Wallet(k, ethers.provider));

  return { reporters, investors };
}

async function contracts() {
  const book = loadBook();
  return {
    book,
    assets: await ethers.getContractAt("RWAAssetRegistry", book.contracts.RWAAssetRegistry),
    engine: await ethers.getContractAt("PriceValidationEngine", book.contracts.PriceValidationEngine),
    factory: await ethers.getContractAt("MarketFactory", book.contracts.MarketFactory),
  };
}

function link(book: any, hash: string) {
  return `${book.explorer}/tx/${hash}`;
}

const REJECT_REASON = [
  "None", "No quote", "Stale", "Spread too wide", "Insufficient depth", "Deviation exceeded",
];
const FAILURE_REASON = ["None", "Too few sources", "Too few source kinds"];

/**
 * Publish one quote per reporter, optionally corrupting some of them, then run a
 * validation round and report exactly what the engine decided.
 */
async function publishRound(
  engine: any,
  book: any,
  reporters: Wallet[],
  opts: { spoofIndices?: number[] } = {}
) {
  const now = Math.floor(Date.now() / 1000);
  const spoofed = new Set(opts.spoofIndices ?? []);

  for (const [i, r] of reporters.entries()) {
    let price = SILVER_BASE + BigInt(i) * (E18 / 100n);
    const isSpoof = spoofed.has(i);
    if (isSpoof) price = (price * 140n) / 100n; // 40% above the pack

    const half = price / 4000n;
    const tx = await (engine.connect(r) as any).submitQuote(
      FEED2_ID, price, price - half, price + half, 60_000n * E18, now
    );
    await tx.wait();
    console.log(
      `  source ${i} published ${ethers.formatEther(price)}` +
        `${isSpoof ? "   <-- MANIPULATED (40% above the others)" : ""}`
    );
    console.log(`    ${link(book, tx.hash)}`);
  }

  const vtx = await engine.validate(FEED2_ID);
  const rc = await vtx.wait();
  console.log(`  validate() -> ${link(book, vtx.hash)}`);

  const outcome = { rejected: [] as string[], validated: null as any, failed: null as any };
  for (const log of rc.logs) {
    let ev;
    try {
      ev = engine.interface.parseLog(log);
    } catch {
      continue;
    }
    if (ev?.name === "SourceRejected") {
      outcome.rejected.push(`${ev.args.reporter} (${REJECT_REASON[Number(ev.args.reason)]})`);
      console.log(`  REJECTED  ${ev.args.reporter}  reason: ${REJECT_REASON[Number(ev.args.reason)]}`);
    }
    if (ev?.name === "PriceValidated") {
      outcome.validated = ev.args;
      console.log(
        `  VALIDATED ${ethers.formatEther(ev.args.price)} ` +
          `from ${ev.args.sourceCount} sources / ${ev.args.distinctKinds} kinds`
      );
    }
    if (ev?.name === "ValidationFailed") {
      outcome.failed = ev.args;
      console.log(
        `  ROUND FAILED  ${FAILURE_REASON[Number(ev.args.reason)]} ` +
          `(only ${ev.args.survivors} source(s) survived)`
      );
    }
    if (ev?.name === "FeedPaused") {
      console.log(`  FEED PAUSED  consecutive failures reached the limit`);
    }
  }
  return outcome;
}

async function status() {
  const { book, assets, engine, factory } = await contracts();
  const S = ["NONE", "PROPOSED", "ACTIVE", "REJECTED", "PAUSED", "RETIRED"];

  console.log(`\nnetwork ${network.name}\n`);

  const assetStatus = Number(await assets.statusOf(ASSET2_ID));
  console.log(`silver asset   ${["NONE", "PENDING", "ACTIVE", "SUSPENDED", "RETIRED"][assetStatus]}`);

  let feedExists = true;
  try {
    await engine.getFeed(FEED2_ID);
  } catch {
    feedExists = false;
  }

  if (feedExists) {
    const [price, validatedAt, count, paused, fresh] = await engine.peekPrice(FEED2_ID);
    console.log(
      `silver feed    ${ethers.formatEther(price)} (${count} sources, paused=${paused}, fresh=${fresh}), ` +
        `${await engine.validationCount(FEED2_ID)} rounds`
    );
  } else {
    console.log(`silver feed    not created`);
  }

  const marketId = await factory.computeMarketId(ASSET2_ID, FEED2_ID);
  const st = Number(await factory.statusOf(marketId));
  console.log(`silver market  ${S[st]}`);

  if (st === 1) {
    const p = await factory.activationProgress(marketId);
    console.log(
      `  seasoning    ${p.elapsed}/${p.seasoningRequired}s, ` +
        `${p.validationsObserved}/${p.validationsRequired} validations, ready=${p.ready}`
    );
    const m = await factory.getMarket(marketId);
    console.log(`  proposer     ${m.proposer}`);
  }

  console.log(`\nengine totals  ${await engine.totalValidations()} validations, ` +
    `${await engine.totalQuotesSubmitted()} quotes`);
  console.log(`markets        ${await factory.marketCount()} (${await factory.activeMarkets()} active)`);
}

async function main() {
  const act = (process.env.DEMO ?? "status").toLowerCase();
  const { book, assets, engine, factory } = await contracts();
  const { reporters, investors } = wallets();
  const [operator] = await ethers.getSigners();

  if (act === "status") return status();

  if (act === "setup") {
    console.log("\n--- setup: second asset + feed ---\n");

    if (Number(await assets.statusOf(ASSET2_ID)) === 0) {
      const tx = await assets.registerAsset(ASSET2_ID, {
        class: 2, // PRECIOUS_METAL
        symbol: "dXAG",
        name: "DEXless Allocated Silver",
        issuer: operator.address,
        custodian: process.env.CUSTODIAN_ADDRESS || operator.address,
        jurisdiction: 158,
        decimals: 18,
        legalDocURI: "ipfs://REPLACE_WITH_SILVER_CUSTODY_CID",
        legalDocHash: ethers.keccak256(ethers.toUtf8Bytes("silver-custody-agreement-v1")),
      });
      await tx.wait();
      console.log(`  asset registered  ${link(book, tx.hash)}`);
    } else {
      console.log("  asset already registered");
    }

    const cust = await assets.attestCustody(
      ASSET2_ID,
      2000n * E18,
      ethers.keccak256(ethers.toUtf8Bytes(`silver-vault-${Date.now()}`)),
      "ipfs://REPLACE_WITH_SILVER_VAULT_REPORT"
    );
    await cust.wait();
    console.log(`  custody attested  ${link(book, cust.hash)}`);

    let feedExists = true;
    try {
      await engine.getFeed(FEED2_ID);
    } catch {
      feedExists = false;
    }

    if (!feedExists) {
      const ftx = await engine.createFeed(FEED2_ID, "XAG/USD", RISK);
      await ftx.wait();
      console.log(`  feed created      ${link(book, ftx.hash)}`);

      const meta = [
        { kind: 0, name: "MM Desk RFQ" },
        { kind: 1, name: "Binance XAG" },
        { kind: 1, name: "OKX XAG" },
        { kind: 3, name: "Oracle" },
      ];
      for (const [i, r] of reporters.slice(0, 4).entries()) {
        const stx = await engine.addSource(FEED2_ID, r.address, meta[i].kind, meta[i].name);
        await stx.wait();
        console.log(`  source added: ${meta[i].name}  ${link(book, stx.hash)}`);
      }
    } else {
      console.log("  feed already exists");
    }

    console.log("\n  first clean round:");
    await publishRound(engine, book, reporters);
    console.log("\nnext: DEMO=spoof");
    return;
  }

  if (act === "spoof") {
    // One manipulated source out of four still leaves enough honest survivors,
    // so the round validates and the median holds. This is the headline.
    console.log("\n--- Act 3a: one manipulated source, price holds ---\n");
    const [before] = await engine.peekPrice(FEED2_ID);
    console.log(`  validated price before: ${ethers.formatEther(before)}\n`);

    const r1 = await publishRound(engine, book, reporters, { spoofIndices: [2] });

    const [after] = await engine.peekPrice(FEED2_ID);
    console.log(`\n  validated price after : ${ethers.formatEther(after)}`);
    if (r1.validated) {
      console.log(
        `  The manipulated source was excluded and the round still validated\n` +
          `  from the honest survivors. One bad actor cannot move the price.`
      );
    } else {
      console.log(
        `  Rejecting the outlier left too few survivors, so the engine refused\n` +
          `  to publish any new price rather than trust a thin source set.`
      );
    }
    console.log(
      `\n  On BscScan, open the validate() transaction above and read the\n` +
        `  SourceRejected event — the rejection is recorded on-chain, not silent.`
    );
    return;
  }

  if (act === "spoof2") {
    // Two manipulated sources push survivors below minSources, so the engine
    // refuses to publish at all. Repeat it and the feed pauses itself.
    console.log("\n--- Act 3b: majority compromised, the engine refuses to price ---\n");
    const [before] = await engine.peekPrice(FEED2_ID);
    console.log(`  validated price before: ${ethers.formatEther(before)}\n`);

    const r = await publishRound(engine, book, reporters, { spoofIndices: [1, 2] });

    const [after, , , paused, fresh] = await engine.peekPrice(FEED2_ID);
    console.log(`\n  stored price still    : ${ethers.formatEther(after)} (paused=${paused}, fresh=${fresh})`);
    if (r.failed) {
      console.log(
        `  No new price was published. The engine fails safe: it would rather\n` +
          `  serve nothing than a price it cannot corroborate. After enough\n` +
          `  consecutive failures the feed pauses itself and stops serving\n` +
          `  downstream markets entirely.`
      );
    }
    return;
  }

  if (act === "propose") {
    console.log("\n--- Act 4a: propose from a wallet holding NO roles ---\n");
    const proposer = investors[0];
    if (!proposer) throw new Error("INVESTOR_KEY_0 not set");

    // Prove the wallet is unprivileged before using it.
    const roles = [
      { c: assets, r: await assets.REGISTRAR_ROLE(), n: "RWAAssetRegistry.REGISTRAR" },
      { c: engine, r: await engine.FEED_ADMIN_ROLE(), n: "PriceValidationEngine.FEED_ADMIN" },
      { c: factory, r: await factory.MARKET_ADMIN_ROLE(), n: "MarketFactory.MARKET_ADMIN" },
      { c: factory, r: ethers.ZeroHash, n: "MarketFactory.DEFAULT_ADMIN" },
    ];
    console.log(`  proposer ${proposer.address}`);
    for (const x of roles) {
      console.log(`    ${(await x.c.hasRole(x.r, proposer.address)) ? "HAS" : "no "}  ${x.n}`);
    }
    console.log(`    balance ${ethers.formatEther(await ethers.provider.getBalance(proposer.address))} tBNB\n`);

    const bounds = await factory.bounds();
    const tx = await (factory.connect(proposer) as any).proposeMarket(
      ASSET2_ID, FEED2_ID, MARKET2_CONFIG, { value: bounds.bondAmount }
    );
    await tx.wait();
    console.log(`  market proposed   ${link(book, tx.hash)}`);
    console.log(`  bond locked       ${ethers.formatEther(bounds.bondAmount)} tBNB (refunded either way)`);
    console.log(
      `\n  Seasoning: ${bounds.seasoningPeriod}s and ${bounds.requiredValidations} clean validations.` +
        `\n  Run DEMO=tick a few times, then DEMO=activate.`
    );
    return;
  }

  if (act === "tick") {
    console.log("\n--- one validation round ---\n");
    await publishRound(engine, book, reporters);
    const marketId = await factory.computeMarketId(ASSET2_ID, FEED2_ID);
    if (Number(await factory.statusOf(marketId)) === 1) {
      const p = await factory.activationProgress(marketId);
      console.log(
        `\n  seasoning ${p.elapsed}/${p.seasoningRequired}s, ` +
          `${p.validationsObserved}/${p.validationsRequired} validations, ready=${p.ready}`
      );
    }
    return;
  }

  if (act === "activate") {
    console.log("\n--- Act 4b: activated by a DIFFERENT wallet than the proposer ---\n");
    const marketId = await factory.computeMarketId(ASSET2_ID, FEED2_ID);
    const m = await factory.getMarket(marketId);
    const activator = investors[1] ?? investors[0];
    if (!activator) throw new Error("no investor key available");

    const p = await factory.activationProgress(marketId);
    console.log(`  proposer  ${m.proposer}`);
    console.log(`  activator ${activator.address}  <-- not the proposer`);
    console.log(
      `  progress  ${p.elapsed}/${p.seasoningRequired}s, ` +
        `${p.validationsObserved}/${p.validationsRequired} validations, ready=${p.ready}\n`
    );

    if (!p.ready) {
      console.log("  Not ready yet. Run DEMO=tick until the counters are met.");
      return;
    }

    const tx = await (factory.connect(activator) as any).activateMarket(marketId);
    const rc = await tx.wait();
    console.log(`  ACTIVATED  ${link(book, tx.hash)}`);

    // Read the refund off the receipt rather than diffing balances — an RPC can
    // serve a stale balance either side of the call, and the event is the truth.
    for (const log of rc.logs) {
      try {
        const ev = factory.interface.parseLog(log);
        if (ev?.name === "BondRefunded") {
          console.log(
            `  bond refunded to proposer: ${ethers.formatEther(ev.args.amount)} tBNB -> ${ev.args.to}`
          );
        }
        if (ev?.name === "MarketActivated") {
          console.log(`  activated by: ${ev.args.activatedBy}  (${ev.args.validationsObserved} validations observed)`);
        }
      } catch {
        continue;
      }
    }
    console.log(`  bond still held by factory: ${ethers.formatEther((await factory.getMarket(marketId)).bond)} tBNB`);
    console.log(`  active markets now: ${await factory.activeMarkets()}`);
    return;
  }

  throw new Error(`unknown DEMO act "${act}" — use setup | spoof | spoof2 | propose | tick | activate | status`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
