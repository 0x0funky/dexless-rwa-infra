import { ethers } from "ethers";
import { loadEnv } from "./env";
import { SOURCE_ROSTER } from "./config";

loadEnv();

/**
 * Spreads gas from the funded deployer to the reporter and participant wallets,
 * so only one external funding transfer is ever needed.
 *
 *   npx ts-node scripts/fund-wallets.ts
 *   ENV_FILE=.env.mainnet npx ts-node scripts/fund-wallets.ts
 *
 * Idempotent: a wallet already at or above its target is skipped, so re-run it
 * whenever the keeper has drawn a reporter down.
 *
 * Targets are env-tunable because the right amount depends entirely on the
 * keeper interval and how long the deployment needs to survive.
 */

const NETWORK = process.env.KEEPER_NETWORK ?? "bscTestnet";
const IS_MAINNET = NETWORK === "bsc";
const UNIT = IS_MAINNET ? "BNB" : "tBNB";

// REPORTER_KEY_1 also sends validate() every round, so it burns roughly twice
// what a quote-only source does.
const VALIDATOR_TARGET = process.env.VALIDATOR_TARGET ?? (IS_MAINNET ? "0.045" : "0.03");
const REPORTER_TARGET = process.env.REPORTER_TARGET ?? (IS_MAINNET ? "0.025" : "0.03");
const PARTICIPANT_TARGET = process.env.PARTICIPANT_TARGET ?? (IS_MAINNET ? "0.008" : "0.04");

// Reporter targets are derived from the shared roster rather than listed by
// hand — a hand-written copy silently misses any source added later, and an
// unfunded reporter stalls the whole feed.
const TARGETS: { key: string; label: string; target: string }[] = [
  // Legacy slot from the first testnet feed; harmless when unset.
  { key: "REPORTER_KEY_0", label: "price source 0 (retired)", target: REPORTER_TARGET },
  ...SOURCE_ROSTER.map((r, i) => ({
    key: r.keyEnv,
    label: `${r.name}${i === 0 ? " (+validate)" : ""}`,
    // The first roster entry also sends validate() every round.
    target: i === 0 ? VALIDATOR_TARGET : REPORTER_TARGET,
  })),
  // Participants need bond + gas so the permissionless path can be exercised
  // from a wallet holding no roles at all.
  { key: "INVESTOR_KEY_0", label: "participant 0", target: PARTICIPANT_TARGET },
  { key: "INVESTOR_KEY_1", label: "participant 1", target: PARTICIPANT_TARGET },
  { key: "INVESTOR_KEY_2", label: "participant 2", target: PARTICIPANT_TARGET },
];

// Held back for deployment, asset registration and the business flow. Once a
// network is already deployed this is over-cautious — lower it if needed.
const DEPLOYER_RESERVE = ethers.parseEther(process.env.DEPLOYER_RESERVE ?? "0.05");

function rpcFor(): string {
  if (process.env.BSC_RPC_KEEPER) return process.env.BSC_RPC_KEEPER;
  return IS_MAINNET
    ? process.env.BSC_RPC ?? "https://bsc-dataseed.bnbchain.org"
    : process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
}

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcFor());
  const chainId = Number((await provider.getNetwork()).chainId);

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY missing — run scripts/new-wallets.ts");
  const deployer = new ethers.Wallet(deployerKey, provider);

  // Guard against pointing a mainnet env at a testnet RPC, or vice versa.
  if (IS_MAINNET && chainId !== 56) throw new Error(`KEEPER_NETWORK=bsc but RPC is chainId ${chainId}`);
  if (!IS_MAINNET && chainId === 56) throw new Error(`RPC is BNB mainnet but KEEPER_NETWORK=${NETWORK}`);

  const balance = await provider.getBalance(deployer.address);
  console.log(`network  ${NETWORK} (chainId ${chainId})`);
  console.log(`deployer ${deployer.address}`);
  console.log(`balance  ${ethers.formatEther(balance)} ${UNIT}\n`);

  if (balance === 0n) {
    console.error(`Deployer has no ${UNIT}. Fund ${deployer.address} first.`);
    process.exitCode = 1;
    return;
  }

  const plan: { to: string; label: string; amount: bigint }[] = [];
  for (const t of TARGETS) {
    const key = process.env[t.key];
    if (!key) continue; // not every roster slot exists on every network
    const addr = new ethers.Wallet(key).address;
    const have = await provider.getBalance(addr);
    const target = ethers.parseEther(t.target);

    if (have >= target) {
      console.log(`  ok   ${t.label.padEnd(26)} ${addr}  ${ethers.formatEther(have)}`);
      continue;
    }
    plan.push({ to: addr, label: t.label, amount: target - have });
  }

  if (plan.length === 0) {
    console.log("\nall wallets already at target.");
    return;
  }

  const needed = plan.reduce((a, p) => a + p.amount, 0n);
  console.log(`\nneed ${ethers.formatEther(needed)} ${UNIT} for ${plan.length} wallet(s)`);

  if (balance < needed + DEPLOYER_RESERVE) {
    console.error(
      `\nNot enough ${UNIT}. Have ${ethers.formatEther(balance)}, need ` +
        `${ethers.formatEther(needed + DEPLOYER_RESERVE)} ` +
        `(includes ${ethers.formatEther(DEPLOYER_RESERVE)} held back for deployment).\n` +
        `Either top up the deployer, or lower the targets:\n` +
        `  REPORTER_TARGET=… VALIDATOR_TARGET=… PARTICIPANT_TARGET=… DEPLOYER_RESERVE=…`
    );
    process.exitCode = 1;
    return;
  }

  console.log();
  for (const p of plan) {
    const tx = await deployer.sendTransaction({ to: p.to, value: p.amount });
    await tx.wait();
    console.log(`  sent ${ethers.formatEther(p.amount).padEnd(10)} -> ${p.label.padEnd(26)} ${tx.hash.slice(0, 12)}…`);
  }

  const left = await provider.getBalance(deployer.address);
  console.log(`\ndeployer left with ${ethers.formatEther(left)} ${UNIT}`);
  console.log(`next: npm run deploy:${IS_MAINNET ? "mainnet" : "testnet"}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
