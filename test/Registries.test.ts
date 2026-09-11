import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ComplianceRegistry, RWAAssetRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E18 = 10n ** 18n;
const ASSET = ethers.keccak256(ethers.toUtf8Bytes("XAUT-TW-01"));

// Tier
const NONE = 0, RETAIL = 1, ACCREDITED = 2, INSTITUTIONAL = 3;
// AssetClass / Status
const PRECIOUS_METAL = 2;
const S_PENDING = 1, S_ACTIVE = 2, S_SUSPENDED = 3;

const TW = 158; // ISO-3166-1 numeric
const KP = 408; // sanctioned jurisdiction, used for the block test

function assetInput(issuer: string, custodian: string) {
  return {
    class: PRECIOUS_METAL,
    symbol: "dXAU",
    name: "DEXless Allocated Gold",
    issuer,
    custodian,
    jurisdiction: TW,
    decimals: 18,
    legalDocURI: "ipfs://bafkreicustodyagreement",
    legalDocHash: ethers.keccak256(ethers.toUtf8Bytes("custody-agreement-v1")),
  };
}

describe("ComplianceRegistry", () => {
  let reg: ComplianceRegistry;
  let admin: HardhatEthersSigner, alice: HardhatEthersSigner, bob: HardhatEthersSigner;

  beforeEach(async () => {
    [admin, alice, bob] = await ethers.getSigners();
    reg = (await ethers.deployContract("ComplianceRegistry", [
      admin.address,
    ])) as unknown as ComplianceRegistry;
  });

  async function attest(who: string, tier = RETAIL, jur = TW, ttlDays = 365) {
    const expiry = (await time.latest()) + ttlDays * 86400;
    return reg.attest(
      who,
      ethers.keccak256(ethers.toUtf8Bytes(`kyc:${who}`)),
      "ipfs://bafkreikycbundle",
      jur,
      tier,
      expiry
    );
  }

  it("verifies an attested account and counts it once", async () => {
    await expect(attest(alice.address)).to.emit(reg, "Attested");
    expect(await reg.isVerified(alice.address)).to.equal(true);
    expect(await reg.totalAttested()).to.equal(1);
    expect(await reg.activeAttested()).to.equal(1);

    // Re-attesting the same wallet (e.g. renewal) must not double-count.
    await attest(alice.address);
    expect(await reg.totalAttested()).to.equal(1);
    expect(await reg.activeAttested()).to.equal(1);
  });

  it("tracks tiers", async () => {
    await attest(alice.address, ACCREDITED);
    expect(await reg.isVerifiedAtLeast(alice.address, RETAIL)).to.equal(true);
    expect(await reg.isVerifiedAtLeast(alice.address, ACCREDITED)).to.equal(true);
    expect(await reg.isVerifiedAtLeast(alice.address, INSTITUTIONAL)).to.equal(false);
    expect(await reg.tierOf(alice.address)).to.equal(ACCREDITED);
  });

  it("stops verifying after expiry", async () => {
    await attest(alice.address, RETAIL, TW, 1);
    expect(await reg.isVerified(alice.address)).to.equal(true);
    await time.increase(2 * 86400);
    expect(await reg.isVerified(alice.address)).to.equal(false);
    expect(await reg.tierOf(alice.address)).to.equal(NONE);
  });

  it("revokes and decrements the active count", async () => {
    await attest(alice.address);
    await expect(reg.revoke(alice.address, "sanctions screening hit")).to.emit(reg, "AttestationRevoked");
    expect(await reg.isVerified(alice.address)).to.equal(false);
    expect(await reg.activeAttested()).to.equal(0);
    expect(await reg.totalAttested()).to.equal(1); // historical count is preserved
  });

  it("refuses to attest into a blocked jurisdiction and invalidates existing holders", async () => {
    await attest(alice.address, RETAIL, KP);
    expect(await reg.isVerified(alice.address)).to.equal(true);

    await reg.setJurisdictionBlocked(KP, true);
    expect(await reg.isVerified(alice.address)).to.equal(false);

    await expect(attest(bob.address, RETAIL, KP)).to.be.revertedWithCustomError(reg, "BlockedJurisdiction");
  });

  it("rejects tier NONE and past expiries", async () => {
    const past = (await time.latest()) - 1;
    await expect(
      reg.attest(alice.address, ethers.ZeroHash, "", TW, NONE, past + 100000)
    ).to.be.revertedWithCustomError(reg, "InvalidTier");
    await expect(
      reg.attest(alice.address, ethers.ZeroHash, "", TW, RETAIL, past)
    ).to.be.revertedWithCustomError(reg, "InvalidExpiry");
  });

  it("gates attestation behind ATTESTER_ROLE", async () => {
    await expect(
      reg.connect(bob).attest(alice.address, ethers.ZeroHash, "", TW, RETAIL, (await time.latest()) + 1000)
    ).to.be.reverted;
  });
});

describe("RWAAssetRegistry", () => {
  let reg: RWAAssetRegistry;
  let admin: HardhatEthersSigner, issuer: HardhatEthersSigner, custodian: HardhatEthersSigner, outsider: HardhatEthersSigner;

  beforeEach(async () => {
    [admin, issuer, custodian, outsider] = await ethers.getSigners();
    reg = (await ethers.deployContract("RWAAssetRegistry", [
      admin.address,
    ])) as unknown as RWAAssetRegistry;
    await reg.registerAsset(ASSET, assetInput(issuer.address, custodian.address));
  });

  it("registers an asset in PENDING, not yet mintable", async () => {
    expect(await reg.statusOf(ASSET)).to.equal(S_PENDING);
    expect(await reg.isMintable(ASSET)).to.equal(false);

    const a = await reg.getAsset(ASSET);
    expect(a.symbol).to.equal("dXAU");
    expect(a.custodian).to.equal(custodian.address);
    expect(a.legalDocURI).to.equal("ipfs://bafkreicustodyagreement");
  });

  it("promotes to ACTIVE on the custodian's first reserve attestation", async () => {
    await expect(
      reg
        .connect(custodian)
        .attestCustody(ASSET, 1000n * E18, ethers.keccak256(ethers.toUtf8Bytes("vault-report-1")), "ipfs://r1")
    )
      .to.emit(reg, "CustodyAttested")
      .and.to.emit(reg, "AssetStatusChanged");

    expect(await reg.statusOf(ASSET)).to.equal(S_ACTIVE);
    expect(await reg.isMintable(ASSET)).to.equal(true);
    expect(await reg.attestedUnits(ASSET)).to.equal(1000n * E18);
  });

  it("stops being mintable when the attestation goes stale", async () => {
    await reg.connect(custodian).attestCustody(ASSET, 1000n * E18, ethers.ZeroHash, "ipfs://r1");
    expect(await reg.isMintable(ASSET)).to.equal(true);

    await time.increase(40 * 86400); // past the 35-day window
    expect(await reg.isMintable(ASSET)).to.equal(false);
    expect(await reg.statusOf(ASSET)).to.equal(S_ACTIVE); // status unchanged, backing is what lapsed

    await reg.connect(custodian).attestCustody(ASSET, 1000n * E18, ethers.ZeroHash, "ipfs://r2");
    expect(await reg.isMintable(ASSET)).to.equal(true);
  });

  it("only the custodian or a registrar may attest reserves", async () => {
    await expect(
      reg.connect(outsider).attestCustody(ASSET, 1n, ethers.ZeroHash, "")
    ).to.be.revertedWithCustomError(reg, "NotCustodian");

    await expect(reg.attestCustody(ASSET, 1n * E18, ethers.ZeroHash, "")).to.not.be.reverted;
  });

  it("suspends an asset, blocking mintability", async () => {
    await reg.connect(custodian).attestCustody(ASSET, 1000n * E18, ethers.ZeroHash, "ipfs://r1");
    await reg.setStatus(ASSET, S_SUSPENDED, "custodian audit pending");
    expect(await reg.isMintable(ASSET)).to.equal(false);
  });

  it("rejects duplicate registration and unknown lookups", async () => {
    await expect(
      reg.registerAsset(ASSET, assetInput(issuer.address, custodian.address))
    ).to.be.revertedWithCustomError(reg, "AssetExists");

    const unknown = ethers.keccak256(ethers.toUtf8Bytes("nope"));
    await expect(reg.getAsset(unknown)).to.be.revertedWithCustomError(reg, "UnknownAsset");
    expect(await reg.isMintable(unknown)).to.equal(false);
  });

  it("enumerates registered assets", async () => {
    expect(await reg.assetCount()).to.equal(1);
    expect(await reg.assetIdAt(0)).to.equal(ASSET);
  });
});
