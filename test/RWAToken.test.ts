import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ComplianceRegistry, RWAAssetRegistry, RWAToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E18 = 10n ** 18n;
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("XAUT-TW-01"));
const RETAIL = 1, ACCREDITED = 2;
const TW = 158;
const REF = ethers.keccak256(ethers.toUtf8Bytes("subscription-001"));

describe("RWAToken", () => {
  let compliance: ComplianceRegistry;
  let assets: RWAAssetRegistry;
  let token: RWAToken;
  let admin: HardhatEthersSigner, custodian: HardhatEthersSigner;
  let alice: HardhatEthersSigner, bob: HardhatEthersSigner, mallory: HardhatEthersSigner;

  beforeEach(async () => {
    [admin, custodian, alice, bob, mallory] = await ethers.getSigners();

    compliance = (await ethers.deployContract("ComplianceRegistry", [
      admin.address,
    ])) as unknown as ComplianceRegistry;
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
      legalDocURI: "ipfs://bafkreicustodyagreement",
      legalDocHash: ethers.keccak256(ethers.toUtf8Bytes("custody-agreement-v1")),
    });
    // Custodian attests 1,000 units of gold in the vault.
    await assets
      .connect(custodian)
      .attestCustody(ASSET, 1000n * E18, ethers.keccak256(ethers.toUtf8Bytes("vault-1")), "ipfs://r1");

    token = (await ethers.deployContract("RWAToken", [
      "DEXless Allocated Gold",
      "dXAU",
      ASSET,
      await assets.getAddress(),
      await compliance.getAddress(),
      RETAIL,
      admin.address,
    ])) as unknown as RWAToken;

    for (const who of [alice, bob]) await kyc(who.address, RETAIL);
  });

  async function kyc(who: string, tier: number) {
    return compliance.attest(
      who,
      ethers.keccak256(ethers.toUtf8Bytes(`kyc:${who}`)),
      "ipfs://kyc",
      TW,
      tier,
      (await time.latest()) + 365 * 86400
    );
  }

  describe("1:1 backing", () => {
    it("mints up to the attested reserve", async () => {
      await expect(token.mint(alice.address, 600n * E18, REF))
        .to.emit(token, "Minted")
        .withArgs(alice.address, 600n * E18, REF, 600n * E18);

      expect(await token.totalSupply()).to.equal(600n * E18);
      expect(await token.mintableHeadroom()).to.equal(400n * E18);
      // 1000 units custodied against 600 minted => 166.66% backed.
      expect(await token.backingRatioBps()).to.equal((1000n * 10_000n) / 600n);
    });

    it("refuses to mint beyond the attested reserve", async () => {
      await token.mint(alice.address, 1000n * E18, REF);
      await expect(token.mint(alice.address, 1n, REF))
        .to.be.revertedWithCustomError(token, "ExceedsAttestedReserves")
        .withArgs(1000n * E18 + 1n, 1000n * E18);
      expect(await token.mintableHeadroom()).to.equal(0);
    });

    it("lets a fresh custody attestation raise the ceiling", async () => {
      await token.mint(alice.address, 1000n * E18, REF);
      await assets.connect(custodian).attestCustody(ASSET, 1500n * E18, ethers.ZeroHash, "ipfs://r2");
      await expect(token.mint(alice.address, 500n * E18, REF)).to.not.be.reverted;
      expect(await token.totalSupply()).to.equal(1500n * E18);
    });

    it("blocks minting when the custody attestation goes stale", async () => {
      await time.increase(40 * 86400);
      await expect(token.mint(alice.address, 1n * E18, REF))
        .to.be.revertedWithCustomError(token, "AssetNotMintable")
        .withArgs(ASSET);
    });

    it("blocks minting when the asset is suspended", async () => {
      await assets.setStatus(ASSET, 3, "legal review");
      await expect(token.mint(alice.address, 1n * E18, REF)).to.be.revertedWithCustomError(
        token,
        "AssetNotMintable"
      );
    });
  });

  describe("transfer eligibility", () => {
    beforeEach(async () => {
      await token.mint(alice.address, 500n * E18, REF);
    });

    it("permits transfers between verified holders", async () => {
      await expect(token.connect(alice).transfer(bob.address, 100n * E18)).to.not.be.reverted;
      expect(await token.balanceOf(bob.address)).to.equal(100n * E18);
    });

    it("refuses transfers to an unverified wallet", async () => {
      await expect(token.connect(alice).transfer(mallory.address, 1n * E18))
        .to.be.revertedWithCustomError(token, "NotEligible")
        .withArgs(mallory.address);
    });

    it("refuses minting to an unverified wallet", async () => {
      await expect(token.mint(mallory.address, 1n * E18, REF))
        .to.be.revertedWithCustomError(token, "NotEligible")
        .withArgs(mallory.address);
    });

    it("refuses transfers from a holder whose attestation was revoked", async () => {
      await compliance.revoke(alice.address, "sanctions hit");
      await expect(token.connect(alice).transfer(bob.address, 1n * E18))
        .to.be.revertedWithCustomError(token, "NotEligible")
        .withArgs(alice.address);
    });

    it("still lets a de-verified holder redeem, so nobody is trapped", async () => {
      await compliance.revoke(alice.address, "documents expired");
      await expect(token.connect(alice).requestRedemption(100n * E18, REF)).to.emit(
        token,
        "RedemptionRequested"
      );
      expect(await token.balanceOf(alice.address)).to.equal(400n * E18);
    });

    it("enforces a raised minimum tier", async () => {
      await token.setMinTier(ACCREDITED);
      await expect(token.connect(alice).transfer(bob.address, 1n * E18)).to.be.revertedWithCustomError(
        token,
        "NotEligible"
      );

      await kyc(alice.address, ACCREDITED);
      await kyc(bob.address, ACCREDITED);
      await expect(token.connect(alice).transfer(bob.address, 1n * E18)).to.not.be.reverted;
    });
  });

  describe("redemption & controls", () => {
    beforeEach(async () => {
      await token.mint(alice.address, 500n * E18, REF);
    });

    it("burns on redemption and tracks lifetime totals", async () => {
      const settle = ethers.keccak256(ethers.toUtf8Bytes("redemption-001"));
      await expect(token.connect(alice).requestRedemption(200n * E18, settle))
        .to.emit(token, "RedemptionRequested")
        .withArgs(alice.address, 200n * E18, settle, 300n * E18);

      expect(await token.totalSupply()).to.equal(300n * E18);
      expect(await token.totalMinted()).to.equal(500n * E18);
      expect(await token.totalRedeemed()).to.equal(200n * E18);
    });

    it("frees headroom after redemption", async () => {
      await token.mint(bob.address, 500n * E18, REF); // supply now at the 1000 ceiling
      expect(await token.mintableHeadroom()).to.equal(0);
      await token.connect(alice).requestRedemption(200n * E18, REF);
      expect(await token.mintableHeadroom()).to.equal(200n * E18);
    });

    it("pauses all movement", async () => {
      await token.pause();
      await expect(token.connect(alice).transfer(bob.address, 1n)).to.be.reverted;
      await expect(token.mint(alice.address, 1n, REF)).to.be.reverted;
      await token.unpause();
      await expect(token.connect(alice).transfer(bob.address, 1n)).to.not.be.reverted;
    });

    it("allows an admin force-burn for court orders", async () => {
      await expect(token.forceBurn(alice.address, 100n * E18, REF)).to.emit(token, "RedemptionRequested");
      expect(await token.balanceOf(alice.address)).to.equal(400n * E18);
      await expect(token.connect(bob).forceBurn(alice.address, 1n, REF)).to.be.reverted;
    });

    it("gates minting behind MINTER_ROLE", async () => {
      await expect(token.connect(bob).mint(bob.address, 1n, REF)).to.be.reverted;
    });
  });
});
