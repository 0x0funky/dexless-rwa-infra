import { ethers } from "ethers";
import { loadEnv } from "./env";

loadEnv();

/**
 * Prints the balance of every configured wallet on BSC testnet.
 *
 *   npx ts-node scripts/wallet-status.ts
 *
 * Use it to check whether the faucet has landed before deploying, and to spot a
 * reporter that the keeper has drained.
 */

const ROLES = [
  { key: "DEPLOYER_PRIVATE_KEY", label: "deployer / operator" },
  { key: "REPORTER_KEY_0", label: "price source 0 — MM desk" },
  { key: "REPORTER_KEY_1", label: "price source 1 — Binance" },
  { key: "REPORTER_KEY_2", label: "price source 2 — OKX" },
  { key: "REPORTER_KEY_3", label: "price source 3 — Pyth" },
  { key: "REPORTER_KEY_4", label: "price source 4 — Gate.io" },
  { key: "INVESTOR_KEY_0", label: "investor 0" },
  { key: "INVESTOR_KEY_1", label: "investor 1" },
  { key: "INVESTOR_KEY_2", label: "investor 2" },
];

async function main() {
  const rpc = process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
  const provider = new ethers.JsonRpcProvider(rpc);
  const net = await provider.getNetwork();
  const gas = (await provider.getFeeData()).gasPrice ?? 0n;

  console.log(`network  chainId ${net.chainId}  (${rpc})`);
  console.log(`gasPrice ${Number(gas) / 1e9} gwei\n`);

  let total = 0n;
  let funded = 0;

  for (const r of ROLES) {
    const key = process.env[r.key];
    if (!key) {
      console.log(`  --------  ${r.label.padEnd(26)} (${r.key} not set)`);
      continue;
    }
    const addr = new ethers.Wallet(key).address;
    const bal = await provider.getBalance(addr);
    total += bal;
    if (bal > 0n) funded++;

    const flag = bal === 0n ? "EMPTY " : bal < ethers.parseEther("0.005") ? "LOW   " : "ok    ";
    console.log(`  ${flag}  ${r.label.padEnd(26)} ${addr}  ${ethers.formatEther(bal)}`);
  }

  console.log(`\ntotal ${ethers.formatEther(total)} tBNB across ${funded} funded wallet(s)`);

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (deployerKey) {
    const bal = await provider.getBalance(new ethers.Wallet(deployerKey).address);
    if (bal === 0n) {
      console.log("\nDeployer is empty — fund it, then run: npm run rehearse");
      console.log("  https://www.bnbchain.org/en/testnet-faucet");
    } else if (bal < ethers.parseEther("0.15")) {
      console.log("\nDeployer funded but thin. 0.2+ tBNB makes the full rehearsal comfortable.");
    } else {
      console.log("\nReady. Run: npm run rehearse");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
