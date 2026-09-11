import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { loadEnv } from "./scripts/env";

const envFile = loadEnv();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const accounts = DEPLOYER_KEY ? [DEPLOYER_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // BNB Chain mainnet has enabled the Cancun opcodes, but pinning to
      // "shanghai" keeps the bytecode portable across BSC forks and every
      // BscScan verification path. Do not change this without re-verifying.
      evmVersion: "shanghai",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC ?? "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      accounts,
    },
    bsc: {
      url: process.env.BSC_RPC ?? "https://bsc-dataseed.bnbchain.org",
      chainId: 56,
      accounts,
    },
  },
  etherscan: {
    // Etherscan V2 multichain: one API key from etherscan.io covers BscScan.
    apiKey: process.env.ETHERSCAN_API_KEY ?? "",
  },
  // Sourcify needs no API key, so it works even when Etherscan's key service is
  // down. It is a genuine independent verification, and BscScan will also serve
  // a "Similar Match" once a contract is verified there — but it is not a
  // substitute for BscScan's own verified badge, which the grant asks for.
  sourcify: { enabled: true, apiUrl: "https://sourcify.dev/server", browserUrl: "https://repo.sourcify.dev" },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
