import { keccak256, toBytes } from 'viem'
import { ABIS, addressesFor, explorerFor } from './generated'

export { ABIS, addressesFor, explorerFor }

/** Build a wagmi `useReadContract` target, or null when not deployed on this chain. */
export function contractFor(chainId, name) {
  const addresses = addressesFor(chainId)
  if (!addresses?.[name]) return null
  return { address: addresses[name], abi: ABIS[name], chainId }
}

export function isDeployed(chainId) {
  return addressesFor(chainId) != null
}

/** Deterministic ids, matching scripts/config.ts. */
export const id = (s) => keccak256(toBytes(s))

export const PILOT_ASSET_ID = id('DEXLESS-XAU-01')
export const PILOT_FEED_ID = id('XAU/USD')

// ─── Enum mirrors (keep in sync with the Solidity enums) ───

/** PriceValidationEngine.SourceKind */
export const SOURCE_KIND = ['MM_QUOTE', 'CEX', 'DEX', 'ORACLE', 'NAV']
export const SOURCE_KIND_LABEL = {
  MM_QUOTE: 'Market Maker',
  CEX: 'CEX Order Book',
  DEX: 'DEX Pool',
  ORACLE: 'Oracle',
  NAV: 'Fund NAV',
}

/** PriceValidationEngine.RejectReason */
export const REJECT_REASON = [
  'None',
  'No quote',
  'Stale',
  'Spread too wide',
  'Insufficient depth',
  'Deviation exceeded',
]

/** RWAAssetRegistry.AssetClass */
export const ASSET_CLASS = [
  'Unspecified',
  'Fund Share',
  'Precious Metal',
  'Receivable',
  'Equity',
  'Bond',
  'Commodity',
  'Real Estate',
  'Other',
]

/** RWAAssetRegistry.Status */
export const ASSET_STATUS = ['None', 'Pending', 'Active', 'Suspended', 'Retired']

/** MarketFactory.Status */
export const MARKET_STATUS = ['None', 'Proposed', 'Active', 'Rejected', 'Paused', 'Retired']

export const MARKET_STATUS_COLOR = {
  Proposed: 'bg-amber-500/20 text-amber-400',
  Active: 'bg-emerald-500/20 text-emerald-400',
  Rejected: 'bg-gray-500/20 text-gray-400',
  Paused: 'bg-red-500/20 text-red-400',
  Retired: 'bg-gray-500/20 text-gray-400',
}

/** ComplianceRegistry.Tier */
export const TIER = ['Unverified', 'Retail', 'Accredited', 'Institutional']

// ─── Formatting ───

export function shortAddress(a) {
  if (!a) return '—'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function txUrl(chainId, hash) {
  const base = explorerFor(chainId)
  return base ? `${base}/tx/${hash}` : '#'
}

export function addressUrl(chainId, address) {
  const base = explorerFor(chainId)
  return base ? `${base}/address/${address}` : '#'
}

/** Format an 18-decimal fixed-point value for display. */
export function formatUnits18(v, decimals = 2) {
  if (v == null) return '—'
  const neg = v < 0n
  const abs = neg ? -v : v
  const whole = abs / 10n ** 18n
  const frac = (abs % 10n ** 18n) / 10n ** BigInt(18 - decimals)
  const s = `${whole.toLocaleString()}.${frac.toString().padStart(decimals, '0')}`
  return neg ? `-${s}` : s
}

export function formatBps(bps) {
  if (bps == null) return '—'
  return `${(Number(bps) / 100).toFixed(2)}%`
}

/** Seconds → "3m 20s" / "1h 5m". */
export function formatDuration(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s < 0) return '—'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export function timeAgo(unixSeconds) {
  if (!unixSeconds) return 'never'
  const diff = Math.floor(Date.now() / 1000) - Number(unixSeconds)
  if (diff < 5) return 'just now'
  return `${formatDuration(diff)} ago`
}
