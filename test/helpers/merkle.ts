import { ethers } from "ethers";

export interface Entitlement {
  index: number;
  account: string;
  amount: bigint;
}

/**
 * Minimal OpenZeppelin-compatible Merkle tree.
 *
 * Matches `MerkleProof.verify` exactly:
 *   - leaves are double-hashed: keccak256(keccak256(abi.encode(...)))
 *     (the standard second-preimage defence)
 *   - internal nodes hash the pair in ascending order, so proofs carry no
 *     left/right flags
 */
export function buildTree(entitlements: Entitlement[]) {
  const coder = ethers.AbiCoder.defaultAbiCoder();

  const leaf = (e: Entitlement): string =>
    ethers.keccak256(
      ethers.keccak256(coder.encode(["uint256", "address", "uint256"], [e.index, e.account, e.amount]))
    );

  const hashPair = (a: string, b: string): string =>
    BigInt(a) < BigInt(b)
      ? ethers.keccak256(ethers.concat([a, b]))
      : ethers.keccak256(ethers.concat([b, a]));

  // layers[0] = leaves, last layer = [root]
  const layers: string[][] = [entitlements.map(leaf)];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      // An odd node is promoted unchanged, as OZ's JS library does.
      next.push(i + 1 < prev.length ? hashPair(prev[i], prev[i + 1]) : prev[i]);
    }
    layers.push(next);
  }

  const proof = (e: Entitlement): string[] => {
    let idx = entitlements.findIndex(
      (x) => x.index === e.index && x.account === e.account && x.amount === e.amount
    );
    if (idx === -1) throw new Error("entitlement not in tree");

    const out: string[] = [];
    for (let level = 0; level < layers.length - 1; level++) {
      const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (sibling < layers[level].length) out.push(layers[level][sibling]);
      idx = Math.floor(idx / 2);
    }
    return out;
  };

  return { root: layers[layers.length - 1][0], leaf, proof, layers };
}
