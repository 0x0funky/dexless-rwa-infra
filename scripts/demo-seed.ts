import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ASSET, ASSET_ID, FEED_ID, MARKET_CONFIG, RISK } from "./config";

/**
 * Populates a LOCAL Hardhat node with a realistic, fully-exercised system so the
 * dashboard can be reviewed against live contract state before anything is
 * deployed for real.
 *
 *   npx hardhat node                      # terminal 1
 *   SEASONING_PERIOD=60 REQUIRED_VALIDATIONS=3 \
 *     npx hardhat run scripts/demo-seed.ts --network localhost
 *
 * Local only — it refuses to run against a public chain. Nothing here is a
 * substitute for scripts/business-flow.ts, which is what produces the real
 * submission record on BNB Chain.
 */

const E18 = 10n ** 18n;

async function main() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== 31337) {
    throw new Error(`demo-seed is for a local node only (got chainId ${chainId})`);
  }

  const signers = await ethers.getSigners();
  const [operator, custodian] = signers;
  // Four independent reporters, one per price source.
  const [mm, cexA, cexB, navDesk] = signers.slice(2, 6);
  // Retail participants.
  const investors = signers.slice(6, 11);

  const book = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "localhost.json"), "utf8")
  );

  const compliance = await ethers.getContractAt("ComplianceRegistry", book.contracts.ComplianceRegistry);
  const assets = await ethers.getContractAt("RWAAssetRegistry", book.contracts.RWAAssetRegistry);
  const engine = await ethers.getContractAt("PriceValidationEngine", book.contracts.PriceValidationEngine);
  const factory = await ethers.getContractAt("MarketFactory", book.contracts.MarketFactory);
  const token = await ethers.getContractAt("RWAToken", book.contracts.RWAToken);

  console.log("seeding local node…\n");

  // ── 1. Asset + custody ──────────────────────────────────────────────────
  await (
    await assets.registerAsset(ASSET_ID, {
      class: ASSET.class,
      symbol: ASSET.symbol,
      name: ASSET.name,
      issuer: operator.address,
      custodian: custodian.address,
      jurisdiction: ASSET.jurisdiction,
      decimals: ASSET.decimals,
      legalDocURI: "ipfs://bafkreidemocustodyagreement",
      legalDocHash: ethers.keccak256(ethers.toUtf8Bytes("custody-agreement-v1")),
    })
  ).wait();

  await (
    await (assets.connect(custodian) as typeof assets)
      .attestCustody(ASSET_ID, 500n * E18, ethers.keccak256(ethers.toUtf8Bytes("vault-1")), "ipfs://vault-1")
  ).wait();
  console.log("  asset registered + 500 units attested in custody");

  // ── 2. Feed with four independent sources across three kinds ────────────
  await (await engine.createFeed(FEED_ID, "XAU/USD", RISK)).wait();
  const sources = [
    { signer: mm, kind: 0, name: "Desk RFQ" },
    { signer: cexA, kind: 1, name: "Binance PAXG" },
    { signer: cexB, kind: 1, name: "OKX PAXG" },
    { signer: navDesk, kind: 4, name: "JEPUN NAV" },
  ];
  for (const s of sources) {
    await (await engine.addSource(FEED_ID, s.signer.address, s.kind, s.name)).wait();
  }
  console.log(`  feed created with ${sources.length} sources`);

  // ── 3. Several validation rounds with realistic drift ───────────────────
  const base = 2417n * E18;

  async function round(i: number, opts: { spoof?: boolean } = {}) {
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const drift = BigInt(i) * (E18 / 4n); // gentle upward drift

    for (const [j, s] of sources.entries()) {
      let p = base + drift + BigInt(j) * (E18 / 3n);

      // On the flagged round, one CEX prints a manipulated quote. The engine
      // should drop it as a deviation outlier while still validating the round.
      if (opts.spoof && s.name === "OKX PAXG") p = (p * 140n) / 100n;

      const half = p / 4000n; // 2.5bps half-spread
      const oneSided = s.kind === 4; // a NAV print has no two-way market
      await (
        await (engine.connect(s.signer) as typeof engine)
          .submitQuote(
            FEED_ID,
            p,
            oneSided ? 0n : p - half,
            oneSided ? 0n : p + half,
            80_000n * E18,
            now
          )
      ).wait();
    }
    await (await engine.validate(FEED_ID)).wait();
  }

  for (let i = 0; i < 5; i++) await round(i, { spoof: i === 3 });
  console.log("  5 validation rounds (one containing a spoofed quote, rejected)");

  // ── 4. Investors onboarded ──────────────────────────────────────────────
  const expiry = (await ethers.provider.getBlock("latest"))!.timestamp + 365 * 86400;
  for (const inv of investors) {
    await (
      await compliance.attest(
        inv.address,
        ethers.keccak256(ethers.toUtf8Bytes(`kyc:${inv.address}`)),
        "ipfs://kyc-bundle",
        ASSET.jurisdiction,
        1,
        expiry
      )
    ).wait();
  }
  console.log(`  ${investors.length} investors KYC-verified`);

  // ── 5. Issuance 1:1 against reserves, then holder transfers ─────────────
  await (
    await token.mint(investors[0].address, 120n * E18, ethers.keccak256(ethers.toUtf8Bytes("sub-1")))
  ).wait();
  await (
    await token.mint(investors[1].address, 80n * E18, ethers.keccak256(ethers.toUtf8Bytes("sub-2")))
  ).wait();
  await (
    await (token.connect(investors[0]) as typeof token).transfer(investors[2].address, 15n * E18)
  ).wait();
  console.log("  200 tokens issued to 2 holders, 1 secondary transfer");

  // ── 6. Market proposed, seasoned, activated ─────────────────────────────
  const bounds = await factory.bounds();
  await (
    await factory.proposeMarket(ASSET_ID, FEED_ID, MARKET_CONFIG, { value: bounds.bondAmount })
  ).wait();

  const marketId = await factory.computeMarketId(ASSET_ID, FEED_ID);
  await network.provider.send("evm_increaseTime", [Number(bounds.seasoningPeriod) + 5]);
  for (let i = 5; i < 9; i++) await round(i);

  const progress = await factory.activationProgress(marketId);
  if (progress.ready) {
    await (await factory.activateMarket(marketId)).wait();
    console.log("  market proposed → seasoned → ACTIVATED");
  } else {
    console.log(
      `  market still seasoning: ${progress.elapsed}/${progress.seasoningRequired}s, ` +
        `${progress.validationsObserved}/${progress.validationsRequired} validations`
    );
  }

  // ── 7. A second market left mid-seasoning, so the UI shows progress ─────
  const feed2 = ethers.keccak256(ethers.toUtf8Bytes("TSLA/USD"));
  const asset2 = ethers.keccak256(ethers.toUtf8Bytes("DEXLESS-TSLA-01"));

  await (
    await assets.registerAsset(asset2, {
      class: 4, // EQUITY
      symbol: "dTSLA",
      name: "Tokenised Tesla Inc. Shares",
      issuer: operator.address,
      custodian: custodian.address,
      jurisdiction: 840,
      decimals: 18,
      legalDocURI: "ipfs://bafkreidemoequity",
      legalDocHash: ethers.keccak256(ethers.toUtf8Bytes("equity-custody-v1")),
    })
  ).wait();
  await (
    await (assets.connect(custodian) as typeof assets).attestCustody(asset2, 1000n * E18, ethers.ZeroHash, "ipfs://vault-2")
  ).wait();

  await (await engine.createFeed(feed2, "TSLA/USD", RISK)).wait();
  for (const s of sources.slice(0, 3)) {
    await (await engine.addSource(feed2, s.signer.address, s.kind, s.name)).wait();
  }
  {
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    for (const [j, s] of sources.slice(0, 3).entries()) {
      const p = 331n * E18 + BigInt(j) * (E18 / 10n);
      const half = p / 4000n;
      await (
        await (engine.connect(s.signer) as typeof engine).submitQuote(feed2, p, p - half, p + half, 60_000n * E18, now)
      ).wait();
    }
    await (await engine.validate(feed2)).wait();
  }
  await (
    await factory.proposeMarket(
      asset2,
      feed2,
      { ...MARKET_CONFIG, orderlySymbol: "PERP_TSLA_USDC", maxLeverage: 5n },
      { value: bounds.bondAmount }
    )
  ).wait();
  console.log("  second market (dTSLA) left mid-seasoning to show progress\n");

  // ── Summary ─────────────────────────────────────────────────────────────
  const [price, , count, paused, fresh] = await engine.peekPrice(FEED_ID);
  console.log("state:");
  console.log(`  XAU/USD          ${ethers.formatEther(price)} (${count} sources, paused=${paused}, fresh=${fresh})`);
  console.log(`  validations      ${await engine.totalValidations()}`);
  console.log(`  quotes           ${await engine.totalQuotesSubmitted()}`);
  console.log(`  verified users   ${await compliance.totalAttested()}`);
  console.log(`  markets          ${await factory.marketCount()} (${await factory.activeMarkets()} active)`);
  console.log(`  token supply     ${ethers.formatEther(await token.totalSupply())} dXAU`);
  console.log(`  backing          ${await token.backingRatioBps()} bps`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
