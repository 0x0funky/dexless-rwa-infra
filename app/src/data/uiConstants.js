// UI-only constants and formatters.
//
// This file deliberately contains NO asset, market, price or activity data.
// Everything the app displays is read live from the contracts (see
// src/hooks/useDexless.js). Shipping fabricated listings alongside a real
// deployment would misrepresent the protocol's actual on-chain state.

// ─── Asset classes — must match RWAAssetRegistry.AssetClass ordering ───
export const ASSET_CATEGORIES = [
  { id: 1, key: 'fund-share', label: 'Fund Share', icon: 'file-text', desc: 'NAV-priced fund units' },
  { id: 2, key: 'precious-metal', label: 'Precious Metal', icon: 'diamond', desc: 'Allocated gold, silver, platinum' },
  { id: 3, key: 'receivable', label: 'Receivable', icon: 'file-text', desc: 'Invoices, trade receivables' },
  { id: 4, key: 'equity', label: 'Equity', icon: 'bar-chart', desc: 'Company shares, private equity' },
  { id: 5, key: 'bond', label: 'Bond', icon: 'file-text', desc: 'Government and corporate debt' },
  { id: 6, key: 'commodity', label: 'Commodity', icon: 'diamond', desc: 'Energy, agricultural products' },
  { id: 7, key: 'real-estate', label: 'Real Estate', icon: 'building', desc: 'Properties, land, buildings' },
  { id: 8, key: 'other', label: 'Other', icon: 'zap', desc: 'Anything not covered above' },
]

export function categoryById(id) {
  return ASSET_CATEGORIES.find((c) => c.id === Number(id)) ?? null
}

// ─── Price source kinds — must match PriceValidationEngine.SourceKind ───
export const SOURCE_KINDS = [
  { id: 0, key: 'MM_QUOTE', label: 'Market Maker', desc: 'Trading desk RFQ, two-sided with size' },
  { id: 1, key: 'CEX', label: 'CEX Order Book', desc: 'Centralised exchange top of book' },
  { id: 2, key: 'DEX', label: 'DEX Pool', desc: 'On-chain AMM or order book' },
  { id: 3, key: 'ORACLE', label: 'Oracle', desc: 'Third-party oracle network' },
  { id: 4, key: 'NAV', label: 'Fund NAV', desc: 'Administrator net asset value — one-sided' },
]

// ─── Investor tiers — must match ComplianceRegistry.Tier ───
export const INVESTOR_TIERS = [
  { id: 1, key: 'RETAIL', label: 'Retail', desc: 'Basic KYC completed' },
  { id: 2, key: 'ACCREDITED', label: 'Accredited', desc: 'Accredited / professional investor' },
  { id: 3, key: 'INSTITUTIONAL', label: 'Institutional', desc: 'Verified institutional entity' },
]

// ─── ISO-3166-1 numeric codes, as stored on-chain ───
export const JURISDICTIONS = [
  { code: 158, label: 'Taiwan' },
  { code: 344, label: 'Hong Kong' },
  { code: 702, label: 'Singapore' },
  { code: 392, label: 'Japan' },
  { code: 756, label: 'Switzerland' },
  { code: 826, label: 'United Kingdom' },
  { code: 840, label: 'United States' },
  { code: 784, label: 'United Arab Emirates' },
  { code: 136, label: 'Cayman Islands' },
  { code: 92, label: 'British Virgin Islands' },
]

export function jurisdictionLabel(code) {
  return JURISDICTIONS.find((j) => j.code === Number(code))?.label ?? `ISO ${code}`
}

// ─── Formatters ───

export function formatCurrency(n, decimals = 0) {
  if (n == null) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3 && decimals === 0) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 2),
  })}`
}

export function formatNumber(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatUnixDate(seconds) {
  if (!seconds) return '—'
  return new Date(Number(seconds) * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
