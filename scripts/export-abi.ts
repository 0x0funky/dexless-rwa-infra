import * as fs from "fs";
import * as path from "path";

/**
 * Generates `app/src/lib/generated.js` from Hardhat artifacts and the deployment
 * address books, so the frontend can never drift from the deployed contracts.
 *
 *   npx hardhat compile && npx ts-node scripts/export-abi.ts
 *
 * Run it after every deploy. The output file is generated — do not edit it.
 */

const CONTRACTS = [
  { name: "PriceValidationEngine", dir: "core" },
  { name: "MarketFactory", dir: "core" },
  { name: "RWAAssetRegistry", dir: "registry" },
  { name: "ComplianceRegistry", dir: "registry" },
  { name: "RWAToken", dir: "token" },
  { name: "FeeDistributor", dir: "token" },
];

const root = path.join(__dirname, "..");

function loadAbi(c: { name: string; dir: string }) {
  const file = path.join(root, "artifacts", "contracts", c.dir, `${c.name}.sol`, `${c.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`missing artifact for ${c.name} — run "npx hardhat compile" first`);
  return JSON.parse(fs.readFileSync(file, "utf8")).abi;
}

function loadDeployments() {
  const dir = path.join(root, "deployments");
  const out: Record<string, any> = {};
  if (!fs.existsSync(dir)) return out;

  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const book = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out[book.chainId] = { contracts: book.contracts, explorer: book.explorer, network: book.network };
  }
  return out;
}

const abis = Object.fromEntries(CONTRACTS.map((c) => [c.name, loadAbi(c)]));
const deployments = loadDeployments();

const banner =
  "// GENERATED FILE — do not edit.\n" +
  "// Produced by scripts/export-abi.ts from Hardhat artifacts + deployments/.\n" +
  "// Regenerate after every deploy:  npx ts-node scripts/export-abi.ts\n\n";

const body =
  `export const ABIS = ${JSON.stringify(abis)};\n\n` +
  `export const DEPLOYMENTS = ${JSON.stringify(deployments, null, 2)};\n\n` +
  `/** Contract addresses for a chain, or null when not deployed there. */\n` +
  `export function addressesFor(chainId) {\n` +
  `  return DEPLOYMENTS[String(chainId)]?.contracts ?? null;\n` +
  `}\n\n` +
  `export function explorerFor(chainId) {\n` +
  `  return DEPLOYMENTS[String(chainId)]?.explorer ?? "";\n` +
  `}\n`;

const outFile = path.join(root, "app", "src", "lib", "generated.js");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, banner + body);

const chains = Object.keys(deployments);
console.log(`wrote ${outFile}`);
console.log(`  ABIs        ${CONTRACTS.map((c) => c.name).join(", ")}`);
console.log(`  deployments ${chains.length ? chains.map((c) => `chainId ${c}`).join(", ") : "none yet"}`);
