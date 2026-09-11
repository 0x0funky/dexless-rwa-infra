import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MarketFactory, PriceValidationEngine, RWAAssetRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E18 = 10n ** 18n;
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("XAUT-TW-01"));
const FEED = ethers.keccak256(ethers.toUtf8Bytes("XAU/USD"));
const TW = 158;

// Status
const PROPOSED = 1, ACTIVE = 2, REJECTED = 3, PAUSED = 4;

const RISK = {
  maxDeviationBps: 200n,
  maxSpreadBps: 50n,
  maxStaleness: 3600n,
  minDepth: 10_000n * E18,
  minSources: 3n,
  minDistinctKinds: 2n,
  failuresToPause: 3n,
};

const BOUNDS = {
  maxLeverageCap: 20n,
  minInitialMarginBps: 500n, // >= 5%
  minMaintenanceMarginBps: 250n, // >= 2.5%
  seasoningPeriod: 3600n, // 1 hour
  requiredValidations: 5n,
  proposalTTL: 7n * 86400n,
  bondAmount: ethers.parseEther("0.1"),
};

const CONFIG = {
  maxLeverage: 10n,
  initialMarginBps: 1000n,
  maintenanceMarginBps: 500n,
  tickSize: 10n ** 16n,
  minOrderSize: E18,
  orderlySymbol: "PERP_XAU_USDC",
};

describe("MarketFactory", () => {
  let engine: PriceValidationEngine;
  let assets: RWAAssetRegistry;
  let factory: MarketFactory;
  let admin: HardhatEthersSigner, custodian: HardhatEthersSigner, treasury: HardhatEthersSigner;
  let proposer: HardhatEthersSigner, anyone: HardhatEthersSigner;
  let mm: HardhatEthersSigner, cex: HardhatEthersSigner, dex: HardhatEthersSigner;
  let marketId: string;

  beforeEach(async () => {
    [admin, custodian, treasury, proposer, anyone, mm, cex, dex] = await ethers.getSigners();

    engine = (await ethers.deployContract("PriceValidationEngine", [
      admin.address,
    ])) as unknown as PriceValidationEngine;
    assets = (await ethers.deployContract("RWAAssetRegistry", [
      admin.address,
    ])) as unknown as RWAAssetRegistry;

    await assets.registerAsset(ASSET, {
      class: 2,
      symbol: "dXAU",
      name: "DEXless Allocated Gold",
      issuer: admin.address,
      custodian: custodian.address,
      jurisdiction: TW,
      decimals: 18,
      legalDocURI: "ipfs://doc",
      legalDocHash: ethers.ZeroHash,
    });
    await assets.connect(custodian).attestCustody(ASSET, 1000n * E18, ethers.ZeroHash, "ipfs://r1");

    await engine.createFeed(FEED, "XAU/USD", RISK);
    await engine.addSource(FEED, mm.address, 0, "Desk A");
    await engine.addSource(FEED, cex.address, 1, "Binance");
    await engine.addSource(FEED, dex.address, 2, "PancakeSwap");

    factory = (await ethers.deployContract("MarketFactory", [
      admin.address,
      await engine.getAddress(),
      await assets.getAddress(),
      treasury.address,
      BOUNDS,
    ])) as unknown as MarketFactory;

    marketId = await factory.computeMarketId(ASSET, FEED);
    await runValidation(); // feed must already be tradable before a proposal is accepted
  });

  /** Push a fresh, consistent quote set and validate once. */
  async function runValidation(price = 2000n) {
    const now = await time.latest();
    const p = price * E18;
    const half = p / 2000n; // 5bps spread
    for (const s of [mm, cex, dex]) {
      await engine.connect(s).submitQuote(FEED, p, p - half, p + half, 100_000n * E18, now);
    }
    await engine.validate(FEED);
  }

  async function propose() {
    return factory.connect(proposer).proposeMarket(ASSET, FEED, CONFIG, { value: BOUNDS.bondAmount });
  }

  describe("proposal", () => {
    it("accepts a well-formed proposal with a bond", async () => {
      await expect(propose()).to.emit(factory, "MarketProposed");
      expect(await factory.statusOf(marketId)).to.equal(PROPOSED);

      const m = await factory.getMarket(marketId);
      expect(m.proposer).to.equal(proposer.address);
      expect(m.bond).to.equal(BOUNDS.bondAmount);
      expect(m.config.orderlySymbol).to.equal("PERP_XAU_USDC");
    });

    it("rejects a proposal for an unbacked asset", async () => {
      await time.increase(40 * 86400); // custody attestation lapses
      await runValidation();
      await expect(propose()).to.be.revertedWithCustomError(factory, "AssetNotActive");
    });

    it("rejects a proposal against a feed that is not producing prices", async () => {
      const coldFeed = ethers.keccak256(ethers.toUtf8Bytes("COLD"));
      await engine.createFeed(coldFeed, "cold", RISK);
      await expect(
        factory.connect(proposer).proposeMarket(ASSET, coldFeed, CONFIG, { value: BOUNDS.bondAmount })
      ).to.be.revertedWithCustomError(factory, "FeedNotTradable");
    });

    it("rejects the wrong bond amount", async () => {
      await expect(
        factory.connect(proposer).proposeMarket(ASSET, FEED, CONFIG, { value: 1n })
      ).to.be.revertedWithCustomError(factory, "IncorrectBond");
    });

    it("rejects risk parameters outside the global bounds", async () => {
      const cases = [
        { ...CONFIG, maxLeverage: 50n }, // over the leverage cap
        { ...CONFIG, initialMarginBps: 100n }, // under the margin floor
        { ...CONFIG, maintenanceMarginBps: 1000n }, // >= initial margin
        { ...CONFIG, tickSize: 0n },
        { ...CONFIG, orderlySymbol: "" },
      ];
      for (const c of cases) {
        await expect(
          factory.connect(proposer).proposeMarket(ASSET, FEED, c, { value: BOUNDS.bondAmount })
        ).to.be.revertedWithCustomError(factory, "ConfigOutOfBounds");
      }
    });

    it("rejects a duplicate market", async () => {
      await propose();
      await expect(propose()).to.be.revertedWithCustomError(factory, "MarketExists");
    });
  });

  describe("seasoning and activation", () => {
    beforeEach(async () => {
      await propose();
    });

    it("refuses activation before the seasoning period elapses", async () => {
      for (let i = 0; i < 5; i++) await runValidation();
      await expect(factory.activateMarket(marketId)).to.be.revertedWithCustomError(
        factory,
        "SeasoningIncomplete"
      );
    });

    it("refuses activation without enough validations, even after the wait", async () => {
      await time.increase(3700);
      await runValidation(); // only 1 of the 5 required
      await expect(factory.activateMarket(marketId)).to.be.revertedWithCustomError(
        factory,
        "InsufficientValidations"
      );
    });

    it("activates once seasoned, permissionlessly, and refunds the bond", async () => {
      for (let i = 0; i < 5; i++) await runValidation();
      await time.increase(3700);
      await runValidation(); // keep the price fresh

      const before = await ethers.provider.getBalance(proposer.address);
      // Note the caller is `anyone`, not the proposer: no committee approves this.
      await expect(factory.connect(anyone).activateMarket(marketId))
        .to.emit(factory, "MarketActivated")
        .and.to.emit(factory, "BondRefunded");

      expect(await factory.statusOf(marketId)).to.equal(ACTIVE);
      expect(await factory.activeMarkets()).to.equal(1);
      expect(await ethers.provider.getBalance(proposer.address)).to.equal(before + BOUNDS.bondAmount);
    });

    it("reports seasoning progress for the UI", async () => {
      let p = await factory.activationProgress(marketId);
      expect(p.ready).to.equal(false);
      expect(p.validationsRequired).to.equal(5n);

      for (let i = 0; i < 5; i++) await runValidation();
      await time.increase(3700);
      await runValidation();

      p = await factory.activationProgress(marketId);
      expect(p.validationsObserved).to.be.greaterThanOrEqual(5n);
      expect(p.ready).to.equal(true);
    });

    it("refuses activation if the feed went bad during seasoning", async () => {
      for (let i = 0; i < 5; i++) await runValidation();
      await time.increase(4000); // price now stale
      await expect(factory.activateMarket(marketId)).to.be.revertedWithCustomError(
        factory,
        "FeedNotTradable"
      );
    });

    it("lets anyone clear out an expired proposal and refunds the bond", async () => {
      await time.increase(8 * 86400);
      const before = await ethers.provider.getBalance(proposer.address);
      await expect(factory.connect(anyone).rejectStaleProposal(marketId))
        .to.emit(factory, "MarketRejected")
        .withArgs(marketId, "proposal expired");

      expect(await factory.statusOf(marketId)).to.equal(REJECTED);
      expect(await ethers.provider.getBalance(proposer.address)).to.equal(before + BOUNDS.bondAmount);
    });

    it("refuses to reject a healthy proposal", async () => {
      await expect(factory.rejectStaleProposal(marketId)).to.be.revertedWithCustomError(
        factory,
        "MarketStillHealthy"
      );
    });
  });

  describe("monitoring and safety", () => {
    beforeEach(async () => {
      await propose();
      for (let i = 0; i < 5; i++) await runValidation();
      await time.increase(3700);
      await runValidation();
      await factory.activateMarket(marketId);
    });

    it("lets anyone halt a market whose feed has stopped validating", async () => {
      await time.increase(4000); // feed goes stale
      await expect(factory.connect(anyone).pauseUnhealthyMarket(marketId))
        .to.emit(factory, "MarketPaused")
        .withArgs(marketId, anyone.address, "feed or asset unhealthy");

      expect(await factory.statusOf(marketId)).to.equal(PAUSED);
      expect(await factory.activeMarkets()).to.equal(0);
    });

    it("refuses to halt a healthy market", async () => {
      await expect(factory.connect(anyone).pauseUnhealthyMarket(marketId)).to.be.revertedWithCustomError(
        factory,
        "MarketStillHealthy"
      );
    });

    it("resumes only once the feed is healthy again", async () => {
      await time.increase(4000);
      await factory.pauseUnhealthyMarket(marketId);

      await expect(factory.resumeMarket(marketId)).to.be.revertedWithCustomError(factory, "FeedNotTradable");
      await runValidation();
      await expect(factory.resumeMarket(marketId)).to.emit(factory, "MarketResumed");
      expect(await factory.activeMarkets()).to.equal(1);
    });

    it("restricts the operator halt to MARKET_ADMIN_ROLE", async () => {
      await expect(factory.connect(anyone).pauseMarket(marketId, "ops")).to.be.reverted;
      await expect(factory.pauseMarket(marketId, "regulatory notice")).to.emit(factory, "MarketPaused");
    });
  });
});
