import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { PriceValidationEngine } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const FEED = ethers.keccak256(ethers.toUtf8Bytes("XAU/USD"));
const E18 = 10n ** 18n;

// SourceKind
const MM_QUOTE = 0, CEX = 1, DEX = 2, ORACLE = 3, NAV = 4;
// RejectReason
const R_STALE = 2, R_SPREAD = 3, R_DEPTH = 4, R_DEVIATION = 5;
// FailureReason
const F_TOO_FEW_SOURCES = 1, F_TOO_FEW_KINDS = 2;

const RISK = {
  maxDeviationBps: 200n, // 2%
  maxSpreadBps: 50n, // 0.5%
  maxStaleness: 300n, // 5 min
  minDepth: 10_000n * E18, // $10k
  minSources: 3n,
  minDistinctKinds: 2n,
  failuresToPause: 3n,
};

describe("PriceValidationEngine", () => {
  let engine: PriceValidationEngine;
  let admin: HardhatEthersSigner;
  let mm: HardhatEthersSigner, cex: HardhatEthersSigner, dex: HardhatEthersSigner, oracle: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  beforeEach(async () => {
    [admin, mm, cex, dex, oracle, outsider] = await ethers.getSigners();

    engine = (await ethers.deployContract("PriceValidationEngine", [
      admin.address,
    ])) as unknown as PriceValidationEngine;
    await engine.createFeed(FEED, "XAU/USD", RISK);
    await engine.addSource(FEED, mm.address, MM_QUOTE, "Desk A");
    await engine.addSource(FEED, cex.address, CEX, "Binance");
    await engine.addSource(FEED, dex.address, DEX, "PancakeSwap");
    await engine.addSource(FEED, oracle.address, ORACLE, "Chainlink");
  });

  /** Submit a two-sided quote from `signer` at `price` (whole units). */
  async function quote(
    signer: HardhatEthersSigner,
    price: bigint,
    opts: { spreadBps?: bigint; depth?: bigint; ageSec?: number } = {}
  ) {
    const spreadBps = opts.spreadBps ?? 10n;
    const depth = opts.depth ?? 100_000n * E18;
    const now = await time.latest();
    const observedAt = now - (opts.ageSec ?? 0);
    const half = (price * spreadBps) / 20_000n;
    return engine.connect(signer).submitQuote(FEED, price, price - half, price + half, depth, observedAt);
  }

  describe("validation", () => {
    it("accepts a consistent quote set and publishes the median", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2010n * E18);
      await quote(dex, 2005n * E18);

      await expect(engine.validate(FEED))
        .to.emit(engine, "PriceValidated")
        .withArgs(FEED, 2005n * E18, 3, 3, anyUint());

      const [price, , sourceCount, paused, fresh] = await engine.peekPrice(FEED);
      expect(price).to.equal(2005n * E18);
      expect(sourceCount).to.equal(3);
      expect(paused).to.equal(false);
      expect(fresh).to.equal(true);
      expect(await engine.validationCount(FEED)).to.equal(1);
    });

    it("averages the two middle prices when the survivor count is even", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2010n * E18);
      await quote(dex, 2020n * E18);
      await quote(oracle, 2030n * E18);

      await engine.validate(FEED);
      const [price] = await engine.peekPrice(FEED);
      expect(price).to.equal(2015n * E18); // (2010 + 2020) / 2
    });

    it("excludes a source whose price deviates beyond the tolerance", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await quote(oracle, 3000n * E18); // 50% off — manipulated / spoofed

      await expect(engine.validate(FEED))
        .to.emit(engine, "SourceRejected")
        .withArgs(FEED, oracle.address, R_DEVIATION);

      const [price, , sourceCount] = await engine.peekPrice(FEED);
      expect(price).to.equal(2005n * E18);
      expect(sourceCount).to.equal(3); // outlier dropped
    });

    it("excludes a stale quote", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await quote(oracle, 2007n * E18, { ageSec: 600 }); // older than maxStaleness

      await expect(engine.validate(FEED))
        .to.emit(engine, "SourceRejected")
        .withArgs(FEED, oracle.address, R_STALE);
    });

    it("excludes a quote whose spread is too wide", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await quote(oracle, 2007n * E18, { spreadBps: 500n }); // 5% spread

      await expect(engine.validate(FEED))
        .to.emit(engine, "SourceRejected")
        .withArgs(FEED, oracle.address, R_SPREAD);
    });

    it("excludes a quote with insufficient depth", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await quote(oracle, 2007n * E18, { depth: 100n * E18 }); // below minDepth

      await expect(engine.validate(FEED))
        .to.emit(engine, "SourceRejected")
        .withArgs(FEED, oracle.address, R_DEPTH);
    });

    it("accepts a one-sided NAV print, which has no spread to check", async () => {
      const navSigner = outsider;
      await engine.addSource(FEED, navSigner.address, NAV, "JEPUN NAV");

      const now = await time.latest();
      await engine.connect(navSigner).submitQuote(FEED, 2004n * E18, 0, 0, 100_000n * E18, now);
      await quote(mm, 2000n * E18);
      await quote(cex, 2008n * E18);

      await expect(engine.validate(FEED)).to.emit(engine, "PriceValidated");
      const [price, , sourceCount] = await engine.peekPrice(FEED);
      expect(sourceCount).to.equal(3);
      expect(price).to.equal(2004n * E18);
    });

    it("fails when too few sources survive", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);

      await expect(engine.validate(FEED))
        .to.emit(engine, "ValidationFailed")
        .withArgs(FEED, F_TOO_FEW_SOURCES, 2);
      expect(await engine.validationCount(FEED)).to.equal(0);
    });

    it("fails when survivors do not span enough source classes", async () => {
      // Three sources, all of the same kind.
      const feed2 = ethers.keccak256(ethers.toUtf8Bytes("SAME-KIND"));
      await engine.createFeed(feed2, "same kind", RISK);
      const [, a, b, c] = await ethers.getSigners();
      await engine.addSource(feed2, a.address, MM_QUOTE, "Desk A");
      await engine.addSource(feed2, b.address, MM_QUOTE, "Desk B");
      await engine.addSource(feed2, c.address, MM_QUOTE, "Desk C");

      const now = await time.latest();
      // 10bps spread, so the quotes clear every quality filter and the round can
      // only fail on source-class diversity.
      for (const s of [a, b, c]) {
        await engine
          .connect(s)
          .submitQuote(feed2, 100n * E18, 9995n * 10n ** 16n, 10005n * 10n ** 16n, 100_000n * E18, now);
      }

      await expect(engine.validate(feed2))
        .to.emit(engine, "ValidationFailed")
        .withArgs(feed2, F_TOO_FEW_KINDS, 3);
    });
  });

  describe("safety", () => {
    it("pauses the feed after consecutive failures and stops serving prices", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await engine.validate(FEED); // one good round first
      await engine.getPrice(FEED); // serves fine

      // Now let every quote go stale so each round fails.
      await time.increase(1000);
      await engine.validate(FEED);
      await engine.validate(FEED);
      await expect(engine.validate(FEED)).to.emit(engine, "FeedPaused");

      await expect(engine.getPrice(FEED))
        .to.be.revertedWithCustomError(engine, "FeedIsPaused")
        .withArgs(FEED);
      expect(await engine.isTradable(FEED)).to.equal(false);
    });

    it("only an admin can resume, and resuming clears the failure counter", async () => {
      await time.increase(1000);
      for (let i = 0; i < 3; i++) await engine.validate(FEED);

      await expect(engine.connect(outsider).resumeFeed(FEED)).to.be.reverted;
      await expect(engine.resumeFeed(FEED)).to.emit(engine, "FeedResumed").withArgs(FEED, admin.address);

      // Still no fresh price, but no longer flagged paused.
      const [, , , paused] = await engine.peekPrice(FEED);
      expect(paused).to.equal(false);
    });

    it("rejects a price that has gone stale since it was validated", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await engine.validate(FEED);

      await time.increase(400); // beyond maxStaleness
      await expect(engine.getPrice(FEED)).to.be.revertedWithCustomError(engine, "StalePrice");
      expect(await engine.isTradable(FEED)).to.equal(false);
    });

    it("a successful round resets the consecutive failure counter", async () => {
      await time.increase(1000);
      await engine.validate(FEED);
      await engine.validate(FEED); // 2 failures, one short of pausing

      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await engine.validate(FEED); // success — counter resets

      await time.increase(1000);
      await engine.validate(FEED);
      await engine.validate(FEED);
      const [, , , paused] = await engine.peekPrice(FEED);
      expect(paused).to.equal(false); // would have paused had the counter not reset
    });
  });

  describe("access control", () => {
    it("rejects quotes from an address that is not a registered source", async () => {
      const now = await time.latest();
      await expect(
        engine.connect(outsider).submitQuote(FEED, 2000n * E18, 0, 0, 100_000n * E18, now)
      ).to.be.revertedWithCustomError(engine, "NotASource");
    });

    it("ignores a deactivated source", async () => {
      await quote(mm, 2000n * E18);
      await quote(cex, 2005n * E18);
      await quote(dex, 2010n * E18);
      await engine.setSourceActive(FEED, dex.address, false);

      await expect(engine.validate(FEED))
        .to.emit(engine, "ValidationFailed")
        .withArgs(FEED, F_TOO_FEW_SOURCES, 2);
    });

    it("rejects a nonsensical risk config", async () => {
      const bad = { ...RISK, minDistinctKinds: 9n }; // more kinds than minSources
      await expect(
        engine.createFeed(ethers.keccak256(ethers.toUtf8Bytes("BAD")), "bad", bad)
      ).to.be.revertedWithCustomError(engine, "InvalidRiskConfig");
    });

    it("rejects a future-dated or zero-priced quote", async () => {
      const now = await time.latest();
      await expect(
        engine.connect(mm).submitQuote(FEED, 0, 0, 0, 100_000n * E18, now)
      ).to.be.revertedWithCustomError(engine, "InvalidQuote");
      await expect(
        engine.connect(mm).submitQuote(FEED, E18, 0, 0, 100_000n * E18, now + 3600)
      ).to.be.revertedWithCustomError(engine, "InvalidQuote");
    });
  });

  it("submitQuoteAndValidate settles an update in a single transaction", async () => {
    await quote(mm, 2000n * E18);
    await quote(cex, 2005n * E18);
    const now = await time.latest();

    await expect(
      engine
        .connect(dex)
        .submitQuoteAndValidate(FEED, 2010n * E18, 2009n * E18, 2011n * E18, 100_000n * E18, now)
    ).to.emit(engine, "PriceValidated");

    expect(await engine.totalValidations()).to.equal(1);
    expect(await engine.totalQuotesSubmitted()).to.equal(3);
  });
});

/** Matches any uint in an event arg position. */
function anyUint() {
  return (v: bigint) => typeof v === "bigint" && v > 0n;
}
