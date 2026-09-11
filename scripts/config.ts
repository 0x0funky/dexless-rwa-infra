import { ethers } from "ethers";

const E18 = 10n ** 18n;

/**
 * Single source of truth for the pilot asset and market. Edit this file, not the
 * scripts. Everything the deploy / flow / keeper scripts need is derived here.
 */
export const ASSET_ID = ethers.keccak256(ethers.toUtf8Bytes("DEXLESS-XAU-01"));
export const FEED_ID = ethers.keccak256(ethers.toUtf8Bytes("XAU/USD"));

export const ASSET = {
  // AssetClass: 1 FUND_SHARE, 2 PRECIOUS_METAL, 3 RECEIVABLE, 4 EQUITY, 5 BOND, 6 COMMODITY
  class: 2,
  symbol: "dXAU",
  name: "DEXless Allocated Gold",
  jurisdiction: 158, // ISO-3166-1 numeric — 158 = Taiwan
  decimals: 18,
  // Replace with the real IPFS CID of the signed custody agreement before mainnet.
  legalDocURI: "ipfs://REPLACE_WITH_CUSTODY_AGREEMENT_CID",
  legalDocHash: ethers.keccak256(ethers.toUtf8Bytes("REPLACE_WITH_DOCUMENT_BYTES")),
};

export const TOKEN = {
  name: "DEXless Allocated Gold",
  symbol: "dXAU",
  minTier: 1, // 1 RETAIL, 2 ACCREDITED, 3 INSTITUTIONAL
};

/** Risk envelope for the price feed. Tuned for a ~24/5 gold market. */
export const RISK = {
  maxDeviationBps: 200n, // 2% from the median
  maxSpreadBps: 50n, // 0.5% bid/ask
  maxStaleness: 900n, // 15 minutes
  // Depth gating is off by default. Order-book venues publish their true
  // aggregated depth on-chain, but an oracle has no book and honestly reports
  // zero — gating on depth would silently exclude it and cost the feed its
  // cross-source diversity. Freshness, spread, deviation and kind-agreement do
  // the gating instead. Set MIN_DEPTH once every source quotes real size.
  minDepth: ethers.parseEther(process.env.MIN_DEPTH ?? "0"),
  minSources: 3n,
  minDistinctKinds: 2n,
  failuresToPause: 3n,
};

/**
 * Global bounds every market proposal must satisfy.
 *
 * Seasoning is deliberately slow on mainnet — a market has to prove its feed
 * before it can list. For a testnet rehearsal or a local demo that wait is just
 * dead time, so the two seasoning knobs can be shortened via env vars. Never set
 * them on mainnet: they are the listing safety property.
 */
export const BOUNDS = {
  maxLeverageCap: 20n,
  minInitialMarginBps: 500n, // 5%
  minMaintenanceMarginBps: 250n, // 2.5%
  seasoningPeriod: BigInt(process.env.SEASONING_PERIOD ?? 3600), // 1 hour of proven feed history
  requiredValidations: BigInt(process.env.REQUIRED_VALIDATIONS ?? 12), // ...and 12 clean rounds
  proposalTTL: 7n * 86400n,
  bondAmount: ethers.parseEther(process.env.BOND_AMOUNT ?? "0.05"),
};

export const MARKET_CONFIG = {
  maxLeverage: 10n,
  initialMarginBps: 1000n,
  maintenanceMarginBps: 500n,
  tickSize: 10n ** 16n, // 0.01
  minOrderSize: E18 / 100n, // 0.01 units
  orderlySymbol: "PERP_XAU_USDC",
};


/**
 * The canonical price-source roster: which reporter key publishes under which
 * on-chain identity, and which adapter drives it.
 *
 * A source's name and kind are immutable once registered, so this list is the
 * single definition shared by the keeper, the business flow and the feed-wiring
 * script. Duplicating it would eventually put a wrong, permanent label on-chain.
 */
export const SOURCE_ROSTER = [
  { keyEnv: "REPORTER_KEY_1", kind: 1, name: "Binance PAXG", adapter: "binance" },
  { keyEnv: "REPORTER_KEY_2", kind: 1, name: "OKX PAXG", adapter: "okx" },
  { keyEnv: "REPORTER_KEY_3", kind: 3, name: "Pyth XAU/USD", adapter: "pyth" },
  { keyEnv: "REPORTER_KEY_4", kind: 1, name: "Gate.io PAXG", adapter: "gate" },
  // Two independent oracles, not one. The three CEX sources share a single
  // SourceKind, so if the only ORACLE goes down the feed drops to one kind and
  // every round fails the cross-source diversity check. Pyth's public endpoint
  // has already returned 401 once; Chainlink reads straight from chain and
  // updates on a 10-minute cadence, well inside the freshness window.
  { keyEnv: "REPORTER_KEY_5", kind: 3, name: "Chainlink XAU/USD", adapter: "chainlink" },
] as const;

export type SourceAdapterId = (typeof SOURCE_ROSTER)[number]["adapter"];

export const EXPLORER: Record<number, string> = {
  56: "https://bscscan.com",
  97: "https://testnet.bscscan.com",
};

export function explorerFor(chainId: number): string {
  return EXPLORER[chainId] ?? "";
}
