import { network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Verifies every deployed contract on BscScan using the address book written by
 * deploy.ts. Requirement #2 of the grant: source must be publicly auditable.
 *
 *   npx hardhat run scripts/verify.ts --network bsc
 */
async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`no deployment found at ${file} — run deploy.ts first`);

  const book = JSON.parse(fs.readFileSync(file, "utf8"));
  const results: { name: string; address: string; status: string }[] = [];

  for (const [name, address] of Object.entries(book.contracts) as [string, string][]) {
    const args = book.constructorArgs[name];
    process.stdout.write(`verifying ${name} at ${address} ... `);
    try {
      await run("verify:verify", { address, constructorArguments: args });
      console.log("ok");
      results.push({ name, address, status: "verified" });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/already verified/i.test(msg)) {
        console.log("already verified");
        results.push({ name, address, status: "already verified" });
      } else {
        console.log(`FAILED: ${msg.split("\n")[0]}`);
        results.push({ name, address, status: `failed: ${msg.split("\n")[0]}` });
      }
    }
  }

  console.log("\n--- BscScan links (submission material #1) ---\n");
  console.log("| Contract | Address | BscScan |");
  console.log("| --- | --- | --- |");
  for (const r of results) {
    console.log(`| ${r.name} | \`${r.address}\` | [view](${book.explorer}/address/${r.address}#code) |`);
  }

  const failed = results.filter((r) => r.status.startsWith("failed"));
  if (failed.length) {
    console.log(`\n${failed.length} contract(s) failed verification — re-run after a minute.`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
