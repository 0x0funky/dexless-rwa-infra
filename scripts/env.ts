import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

/**
 * Chooses and loads the env file for this process.
 *
 * Resolution order:
 *   1. ENV_FILE, when set explicitly.
 *   2. `.env.mainnet`, when the command targets BNB Chain mainnet
 *      (`--network bsc`) and that file exists.
 *   3. `.env`.
 *
 * Rule 2 is a safety net, not a convenience. Without it, a mainnet command that
 * forgot its ENV_FILE would load the testnet keys and either fail confusingly or
 * — far worse — transact from the wrong wallet. Inferring from the network the
 * user actually named removes that whole class of mistake.
 */
export function loadEnv(): string {
  const root = path.join(__dirname, "..");
  const explicit = process.env.ENV_FILE;

  let file = explicit;
  if (!file) {
    const argv = process.argv;
    const i = argv.indexOf("--network");
    const network = i >= 0 ? argv[i + 1] : undefined;
    const mainnetFile = path.join(root, ".env.mainnet");
    file = network === "bsc" && fs.existsSync(mainnetFile) ? ".env.mainnet" : ".env";
  }

  const full = path.isAbsolute(file) ? file : path.join(root, file);
  if (!fs.existsSync(full)) {
    console.warn(`!! env file ${file} not found — continuing with process environment only`);
    return file;
  }

  dotenv.config({ path: full });
  if (!explicit && file !== ".env") {
    console.log(`env: using ${file} (inferred from --network)`);
  }
  return file;
}

loadEnv();
