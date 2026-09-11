import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

/**
 * Produces everything needed to verify the contracts through BscScan's web form,
 * which requires no API key — the fallback when Etherscan's key service is
 * unavailable.
 *
 *   npx hardhat compile
 *   npx ts-node scripts/export-verification.ts bscTestnet
 *
 * Writes to `verification/<network>/`:
 *   <Contract>.standard-input.json   paste into "Standard-Json-Input"
 *   <Contract>.args.txt              ABI-encoded constructor arguments
 *   README.md                        per-contract field values and steps
 */

const CONTRACTS = [
  { name: "ComplianceRegistry", dir: "registry" },
  { name: "RWAAssetRegistry", dir: "registry" },
  { name: "PriceValidationEngine", dir: "core" },
  { name: "MarketFactory", dir: "core" },
  { name: "RWAToken", dir: "token" },
  { name: "FeeDistributor", dir: "token" },
];

const root = path.join(__dirname, "..");

/** Locate the build-info blob that compiled a given source file. */
function buildInfoFor(sourceName: string) {
  const dir = path.join(root, "artifacts", "build-info");
  if (!fs.existsSync(dir)) throw new Error("no artifacts/build-info — run `npx hardhat compile`");

  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const info = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (info?.input?.sources?.[sourceName]) return info;
  }
  throw new Error(`no build-info contains ${sourceName}`);
}

function main() {
  const networkName = process.argv[2] ?? "bscTestnet";
  const bookPath = path.join(root, "deployments", `${networkName}.json`);
  if (!fs.existsSync(bookPath)) throw new Error(`no deployment at ${bookPath}`);
  const book = JSON.parse(fs.readFileSync(bookPath, "utf8"));

  const outDir = path.join(root, "verification", networkName);
  fs.mkdirSync(outDir, { recursive: true });

  const coder = ethers.AbiCoder.defaultAbiCoder();
  const rows: string[] = [];

  for (const c of CONTRACTS) {
    const sourceName = `contracts/${c.dir}/${c.name}.sol`;
    const info = buildInfoFor(sourceName);

    fs.writeFileSync(
      path.join(outDir, `${c.name}.standard-input.json`),
      JSON.stringify(info.input, null, 2)
    );

    // ABI-encode the constructor arguments exactly as deployed.
    const artifactPath = path.join(root, "artifacts", sourceName, `${c.name}.json`);
    const abi = JSON.parse(fs.readFileSync(artifactPath, "utf8")).abi;
    const ctor = abi.find((e: any) => e.type === "constructor");
    const args = book.constructorArgs[c.name] ?? [];

    let encoded = "";
    if (ctor && ctor.inputs.length > 0) {
      const types = ctor.inputs.map((i: any) =>
        i.type === "tuple" ? `(${i.components.map((x: any) => x.type).join(",")})` : i.type
      );
      const values = args.map((a: any) =>
        a !== null && typeof a === "object" && !Array.isArray(a) ? Object.values(a) : a
      );
      encoded = coder.encode(types, values).slice(2); // BscScan wants no 0x prefix
      fs.writeFileSync(path.join(outDir, `${c.name}.args.txt`), encoded);
    }

    rows.push(
      `### ${c.name}\n\n` +
        `- **Address**: \`${book.contracts[c.name]}\`\n` +
        `- **BscScan**: ${book.explorer}/verifyContract?a=${book.contracts[c.name]}\n` +
        `- **Contract name**: \`${sourceName}:${c.name}\`\n` +
        `- **Standard-Json-Input**: \`${c.name}.standard-input.json\`\n` +
        (encoded
          ? `- **Constructor Arguments** (from \`${c.name}.args.txt\`):\n\n  \`\`\`\n  ${encoded}\n  \`\`\`\n`
          : `- **Constructor Arguments**: none\n`)
    );
  }

  const solc = buildInfoFor("contracts/core/MarketFactory.sol");
  const readme =
    `# BscScan manual verification — ${networkName}\n\n` +
    `No API key required. Do this once per contract.\n\n` +
    `## Settings (identical for all six)\n\n` +
    `| Field | Value |\n| --- | --- |\n` +
    `| Compiler Type | **Solidity (Standard-Json-Input)** |\n` +
    `| Compiler Version | \`v${solc.solcLongVersion}\` |\n` +
    `| Open Source License | MIT |\n\n` +
    `Optimizer settings are already inside the JSON — do not re-enter them.\n\n` +
    `## Steps\n\n` +
    `1. Open the contract's verify URL below.\n` +
    `2. Pick **Solidity (Standard-Json-Input)** and compiler \`v${solc.solcLongVersion}\`.\n` +
    `3. Upload that contract's \`*.standard-input.json\`.\n` +
    `4. Paste the Constructor Arguments string (no leading \`0x\`). Skip if "none".\n` +
    `5. Submit. Verification usually completes in under a minute.\n\n` +
    `Once \`ETHERSCAN_API_KEY\` is available, \`npm run verify:${networkName === "bsc" ? "mainnet" : "testnet"}\` ` +
    `does all six automatically instead.\n\n` +
    `## Contracts\n\n` +
    rows.join("\n");

  fs.writeFileSync(path.join(outDir, "README.md"), readme);

  console.log(`wrote ${outDir}`);
  console.log(`  solc v${solc.solcLongVersion}`);
  for (const c of CONTRACTS) console.log(`  ${c.name}.standard-input.json + args`);
  console.log(`\nOpen verification/${networkName}/README.md and follow it.`);
}

main();
