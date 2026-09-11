import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { FeeDistributor } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { buildTree, Entitlement } from "./helpers/merkle";

const E18 = 10n ** 18n;

describe("FeeDistributor", () => {
  let dist: FeeDistributor;
  let usdt: any;
  let admin: HardhatEthersSigner, treasury: HardhatEthersSigner;
  let alice: HardhatEthersSigner, bob: HardhatEthersSigner, carol: HardhatEthersSigner;
  let entitlements: Entitlement[];
  let tree: ReturnType<typeof buildTree>;

  beforeEach(async () => {
    [admin, treasury, alice, bob, carol] = await ethers.getSigners();

    usdt = await ethers.deployContract("MockERC20", ["Tether USD", "USDT", 18]);
    await usdt.mint(admin.address, 1_000_000n * E18);

    dist = (await ethers.deployContract("FeeDistributor", [
      admin.address,
      treasury.address,
    ])) as unknown as FeeDistributor;

    entitlements = [
      { index: 0, account: alice.address, amount: 600n * E18 },
      { index: 1, account: bob.address, amount: 300n * E18 },
      { index: 2, account: carol.address, amount: 100n * E18 },
    ];
    tree = buildTree(entitlements);
  });

  async function openRound(total = 1000n * E18, windowSec = 30 * 86400) {
    await usdt.approve(await dist.getAddress(), total);
    const now = await time.latest();
    return dist.openRound(
      await usdt.getAddress(),
      total,
      tree.root,
      await ethers.provider.getBlockNumber(),
      now,
      now + windowSec,
      "ipfs://bafkreisnapshot"
    );
  }

  it("matches the contract's leaf encoding", async () => {
    const e = entitlements[0];
    expect(await dist.leafOf(e.index, e.account, e.amount)).to.equal(tree.leaf(e));
  });

  it("opens a funded round", async () => {
    await expect(openRound()).to.emit(dist, "RoundOpened");
    expect(await dist.roundCount()).to.equal(1);
    expect(await usdt.balanceOf(await dist.getAddress())).to.equal(1000n * E18);

    const r = await dist.getRound(0);
    expect(r.merkleRoot).to.equal(tree.root);
    expect(r.snapshotURI).to.equal("ipfs://bafkreisnapshot");
  });

  it("pays each holder their proven share", async () => {
    await openRound();
    for (const e of entitlements) {
      await expect(dist.connect(alice).claim(0, e.index, e.account, e.amount, tree.proof(e)))
        .to.emit(dist, "Claimed")
        .withArgs(0, e.index, e.account, e.amount);
      expect(await usdt.balanceOf(e.account)).to.equal(e.amount);
    }
    expect(await dist.totalClaims()).to.equal(3);
    expect((await dist.getRound(0)).claimedAmount).to.equal(1000n * E18);
  });

  it("refuses a double claim", async () => {
    await openRound();
    const e = entitlements[0];
    await dist.claim(0, e.index, e.account, e.amount, tree.proof(e));
    await expect(dist.claim(0, e.index, e.account, e.amount, tree.proof(e)))
      .to.be.revertedWithCustomError(dist, "AlreadyClaimed")
      .withArgs(0, e.index);
    expect(await dist.isClaimed(0, e.index)).to.equal(true);
  });

  it("refuses an inflated amount or a swapped recipient", async () => {
    await openRound();
    const e = entitlements[0];
    await expect(
      dist.claim(0, e.index, e.account, e.amount + 1n, tree.proof(e))
    ).to.be.revertedWithCustomError(dist, "InvalidProof");
    await expect(
      dist.claim(0, e.index, carol.address, e.amount, tree.proof(e))
    ).to.be.revertedWithCustomError(dist, "InvalidProof");
  });

  it("refuses claims outside the window", async () => {
    const now = await time.latest();
    await usdt.approve(await dist.getAddress(), 1000n * E18);
    await dist.openRound(
      await usdt.getAddress(),
      1000n * E18,
      tree.root,
      await ethers.provider.getBlockNumber(),
      now + 3600,
      now + 7200,
      "ipfs://x"
    );

    const e = entitlements[0];
    await expect(dist.claim(0, e.index, e.account, e.amount, tree.proof(e))).to.be.revertedWithCustomError(
      dist,
      "RoundNotOpen"
    );
    await time.increase(10000);
    await expect(dist.claim(0, e.index, e.account, e.amount, tree.proof(e))).to.be.revertedWithCustomError(
      dist,
      "RoundClosed"
    );
  });

  it("sweeps only the unclaimed remainder, and only after closing", async () => {
    await openRound();
    const e = entitlements[0];
    await dist.claim(0, e.index, e.account, e.amount, tree.proof(e));

    await expect(dist.sweep(0)).to.be.revertedWithCustomError(dist, "RoundStillOpen");
    await time.increase(31 * 86400);

    await expect(dist.sweep(0)).to.emit(dist, "RoundSwept").withArgs(0, treasury.address, 400n * E18);
    expect(await usdt.balanceOf(treasury.address)).to.equal(400n * E18);
    await expect(dist.sweep(0)).to.be.revertedWithCustomError(dist, "AlreadySwept");
  });

  it("gates round creation behind DISTRIBUTOR_ROLE", async () => {
    await expect(
      dist
        .connect(bob)
        .openRound(await usdt.getAddress(), 1n, tree.root, 1, await time.latest(), (await time.latest()) + 100, "")
    ).to.be.reverted;
  });

  it("rejects a window that closes in the past", async () => {
    await usdt.approve(await dist.getAddress(), 1000n * E18);
    const now = await time.latest();
    await expect(
      dist.openRound(await usdt.getAddress(), 1000n * E18, tree.root, 1, now - 100, now - 50, "")
    ).to.be.revertedWithCustomError(dist, "InvalidWindow");
  });
});
