import { useState } from 'react'
import { Card, Button, BackButton, SectionTitle, Badge, Modal, Input } from '../components/UI'
import Icon from '../components/Icons'
import {
  STATUS_CONFIG, ASSET_CATEGORIES, VALUATION_METHODS, TOKEN_STANDARDS,
  formatCurrency, formatNumber, formatDate,
} from '../data/mockData'

export default function AssetDetail({ assetId, onNavigate, listings = [] }) {
  const asset = listings.find((a) => a.id === assetId)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeemConfirm, setRedeemConfirm] = useState('')

  if (!asset) {
    return (
      <div className="p-5">
        <BackButton onClick={() => onNavigate('dashboard')} label="Dashboard" />
        <p className="text-white/40 text-sm">Asset not found</p>
      </div>
    )
  }

  const category = ASSET_CATEGORIES.find((c) => c.id === asset.category)
  const statusCfg = STATUS_CONFIG[asset.status]
  const valMethod = VALUATION_METHODS.find((m) => m.id === asset.valuationMethod)
  const tokStd = TOKEN_STANDARDS.find((t) => t.id === asset.tokenStandard)

  return (
    <div className="p-5 max-w-[1100px] mx-auto animate-fade-in">
      <BackButton onClick={() => onNavigate('dashboard')} label="Marketplace" />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#B084E9]/10 flex items-center justify-center text-[#B084E9]">
            <Icon name={category?.icon} size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold">{asset.name}</h2>
              <Badge color={statusCfg.color}>{statusCfg.label}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
              <span>{category?.label}</span>
              <span>·</span>
              <span className="font-mono">{asset.tokenSymbol}</span>
              <span>·</span>
              <span>Listed {formatDate(asset.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">Edit</Button>
          {asset.status !== 'REDEEMED' && (
            <Button size="sm" variant="danger" onClick={() => setRedeemOpen(true)}>Redeem / Delist</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Left */}
        <div className="space-y-5">
          {/* Description */}
          <Card>
            <SectionTitle>About This Asset</SectionTitle>
            <p className="text-xs text-white/60 leading-relaxed mb-4">{asset.description}</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-white/30 block mb-0.5">Issuer</span>
                <span className="font-medium">{asset.issuerName}</span>
                <span className="block font-mono text-[10px] text-white/25">{asset.issuer}</span>
              </div>
              <div>
                <span className="text-white/30 block mb-0.5">Valuation Method</span>
                <span className="font-medium">{valMethod?.label}</span>
              </div>
              <div>
                <span className="text-white/30 block mb-0.5">Token Standard</span>
                <span className="font-medium">{tokStd?.label}</span>
              </div>
            </div>
          </Card>

          {/* Token Details */}
          <Card>
            <SectionTitle>Token Details</SectionTitle>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
              <Row label="Symbol" value={asset.tokenSymbol} />
              <Row label="Standard" value={tokStd?.label} />
              <Row label="Total Supply" value={formatNumber(asset.totalSupply)} />
              <Row label="Price per Token" value={`$${asset.pricePerToken}`} />
              <Row label="Total Valuation" value={formatCurrency(asset.totalValuation)} />
              <Row label="Quote Currency" value={asset.currency} />
            </div>
          </Card>

          {/* Documents */}
          <Card>
            <SectionTitle>Documents</SectionTitle>
            <div className="space-y-1.5">
              {asset.documents.map((doc, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-white/[0.54]">
                    <Icon name="doc" size={14} />
                    {doc}
                  </span>
                  <button className="text-[#B084E9] text-[10px] hover:underline">View</button>
                </div>
              ))}
            </div>
          </Card>

          {/* Yield Info */}
          {asset.yield.annual > 0 && (
            <Card>
              <SectionTitle>Yield & Income</SectionTitle>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-white/30 block mb-0.5">Annual Yield</span>
                  <span className="text-lg font-bold text-emerald-400">{asset.yield.annual}%</span>
                </div>
                <div>
                  <span className="text-white/30 block mb-0.5">Distribution</span>
                  <span className="font-medium">{asset.yield.frequency}</span>
                </div>
                <div>
                  <span className="text-white/30 block mb-0.5">Last Payout</span>
                  <span className="font-medium">{asset.yield.lastPayout ? formatDate(asset.yield.lastPayout) : '—'}</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4 lg:sticky lg:top-5 self-start">
          {/* Market Metrics */}
          <Card>
            <SectionTitle>Market Metrics</SectionTitle>
            <div className="space-y-2.5">
              <MetricRow label="Token Holders" value={formatNumber(asset.metrics.holders)} />
              <MetricRow label="24h Volume" value={formatCurrency(asset.metrics.volume24h)} />
              <MetricRow label="Tokens Traded" value={formatNumber(asset.metrics.traded)} />
              <MetricRow label="Liquidity" value={formatCurrency(asset.metrics.liquidity)} />
            </div>
          </Card>

          {/* Price Card */}
          <Card className="!bg-gradient-to-br !from-[#280061]/40 !to-[#B084E9]/10 !border-[#B084E9]/15">
            <div className="text-center py-2">
              <span className="text-[10px] text-white/40 block mb-1">Current Price</span>
              <span className="text-2xl font-bold">${asset.pricePerToken}</span>
              <span className="text-xs text-white/30 block mt-0.5">{asset.currency}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button size="sm" className="w-full">Buy</Button>
              <Button size="sm" variant="secondary" className="w-full">Sell</Button>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <SectionTitle>Asset Summary</SectionTitle>
            <div className="space-y-2.5">
              <MetricRow label="Category" value={category?.label} />
              <MetricRow label="Listed" value={formatDate(asset.createdAt)} />
              <MetricRow label="Status" value={<Badge color={statusCfg.color}>{statusCfg.label}</Badge>} />
            </div>
          </Card>
        </div>
      </div>

      {/* Redeem / Delist Modal */}
      <Modal open={redeemOpen} onClose={() => { setRedeemOpen(false); setRedeemConfirm('') }} title="Redeem / Delist Asset">
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300 space-y-1.5">
            <p><strong>Warning:</strong> This action will initiate the delisting process.</p>
            <p>Token trading will be suspended. Existing holders will be notified.</p>
            <p>If this is a redeemable asset, holders can claim their proportional share.</p>
          </div>
          <Input
            label={`Type "${asset.tokenSymbol}" to confirm`}
            placeholder={asset.tokenSymbol}
            value={redeemConfirm}
            onChange={(e) => setRedeemConfirm(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setRedeemOpen(false); setRedeemConfirm('') }}>Cancel</Button>
            <Button variant="danger" className="flex-1" disabled={redeemConfirm !== asset.tokenSymbol}>Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/[0.03]">
      <span className="text-white/35">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-white/35">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
