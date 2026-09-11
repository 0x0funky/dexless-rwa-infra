import { Card, Button, Badge, SectionTitle } from '../components/UI'
import Icon from '../components/Icons'
import { STATUS_CONFIG, ASSET_CATEGORIES, formatCurrency, formatNumber, formatDate } from '../data/mockData'

export default function MyAssets({ onNavigate, listings = [] }) {
  const myAssets = listings

  return (
    <div className="p-5 max-w-[900px] mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold mb-0.5">My Assets</h2>
          <p className="text-xs text-white/40">Assets you've listed on Dexless</p>
        </div>
        <Button onClick={() => onNavigate('create-listing')}>+ List New Asset</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <Card className="!p-3">
          <span className="text-[10px] text-white/35 block mb-0.5">Total Listed</span>
          <span className="text-sm font-semibold">{myAssets.length}</span>
        </Card>
        <Card className="!p-3">
          <span className="text-[10px] text-white/35 block mb-0.5">Total Value</span>
          <span className="text-sm font-semibold">{formatCurrency(myAssets.reduce((s, a) => s + a.totalValuation, 0))}</span>
        </Card>
        <Card className="!p-3">
          <span className="text-[10px] text-white/35 block mb-0.5">Total Holders</span>
          <span className="text-sm font-semibold">{formatNumber(myAssets.reduce((s, a) => s + a.metrics.holders, 0))}</span>
        </Card>
        <Card className="!p-3">
          <span className="text-[10px] text-white/35 block mb-0.5">24h Volume</span>
          <span className="text-sm font-semibold">{formatCurrency(myAssets.reduce((s, a) => s + a.metrics.volume24h, 0))}</span>
        </Card>
      </div>

      {/* Asset List */}
      <SectionTitle>All Listings</SectionTitle>
      <div className="space-y-3">
        {myAssets.map((asset) => {
          const cat = ASSET_CATEGORIES.find((c) => c.id === asset.category)
          const statusCfg = STATUS_CONFIG[asset.status]
          return (
            <Card key={asset.id} onClick={() => onNavigate('asset-detail', asset.id)} className="hover:border-[#B084E9]/25">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#B084E9]/10 flex items-center justify-center text-[#B084E9] flex-shrink-0">
                    <Icon name={cat?.icon} size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{asset.name}</h3>
                      <Badge color={statusCfg.color}>{statusCfg.label}</Badge>
                    </div>
                    <span className="text-[10px] text-white/30">{asset.tokenSymbol} · {formatDate(asset.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs text-right">
                  <div>
                    <span className="text-white/30 block">Valuation</span>
                    <span className="font-semibold">{formatCurrency(asset.totalValuation)}</span>
                  </div>
                  <div>
                    <span className="text-white/30 block">Holders</span>
                    <span className="font-semibold">{formatNumber(asset.metrics.holders)}</span>
                  </div>
                  <div>
                    <span className="text-white/30 block">24h Vol</span>
                    <span className="font-semibold">{formatCurrency(asset.metrics.volume24h)}</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
