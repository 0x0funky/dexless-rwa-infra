import { useAccount, useChainId } from 'wagmi'
import { Badge, Card, ProgressBar, SectionTitle, Button } from '../components/UI'
import { RequireDeployment } from '../components/Wallet'
import { useValidateFeed } from '../hooks/useDexlessWrite'
import {
  useProtocolStats,
  useFeed,
  useFeedQuotes,
  useMarket,
  useAllMarkets,
  useAllAssets,
} from '../hooks/useDexless'
import {
  PILOT_FEED_ID,
  SOURCE_KIND,
  SOURCE_KIND_LABEL,
  MARKET_STATUS,
  MARKET_STATUS_COLOR,
  ASSET_CLASS,
  ASSET_STATUS,
  formatUnits18,
  formatBps,
  formatDuration,
  timeAgo,
  shortAddress,
  addressUrl,
  contractFor,
} from '../lib/contracts'
import { formatNumber } from '../data/uiConstants'

/**
 * Every figure on this page is read live from BNB Chain. Nothing is mocked — if
 * a number appears here, it can be verified on BscScan.
 */
export default function Dashboard({ onNavigate }) {
  return (
    <RequireDeployment>
      <DashboardInner onNavigate={onNavigate} />
    </RequireDeployment>
  )
}

function DashboardInner({ onNavigate }) {
  const chainId = useChainId()
  const { stats, isLoading } = useProtocolStats()
  const engine = contractFor(chainId, 'PriceValidationEngine')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">Permissionless RWA Markets</h1>
          <p className="text-xs text-white/[0.36]">
            We don&apos;t rely on prices. We validate markets.
          </p>
        </div>
        {engine && (
          <a
            href={addressUrl(chainId, engine.address)}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[#B084E9] hover:text-[#D5BEF4] transition-colors"
          >
            View contracts on BscScan ↗
          </a>
        )}
      </div>

      {/* ─── Protocol counters, straight from chain state ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard title="Price feeds" value={fmt(stats.feeds)} loading={isLoading} />
        <StatCard title="Validation rounds" value={fmt(stats.validations)} loading={isLoading} highlight />
        <StatCard title="Quotes submitted" value={fmt(stats.quotes)} loading={isLoading} />
        <StatCard title="Markets" value={fmt(stats.markets)} loading={isLoading} />
        <StatCard title="Active markets" value={fmt(stats.activeMarkets)} loading={isLoading} />
        <StatCard
          title="Verified users"
          value={fmt(stats.verifiedUsers)}
          loading={isLoading}
          color="text-[#46CCB9]"
        />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <FeedPanel feedId={PILOT_FEED_ID} />
        <div className="space-y-6">
          <MarketsPanel onNavigate={onNavigate} />
          <AssetsPanel />
        </div>
      </div>
    </div>
  )
}

const fmt = (v) => (v == null ? '—' : formatNumber(v))

/* ─── Live price feed with per-source breakdown ─────────────────────────── */

function FeedPanel({ feedId }) {
  const { feed, sources, exists, isLoading, refetch } = useFeed(feedId)
  const { quotes } = useFeedQuotes(feedId, sources)
  const { isConnected } = useAccount()
  const validate = useValidateFeed()

  if (isLoading) {
    return (
      <Card>
        <Skeleton lines={6} />
      </Card>
    )
  }

  if (!exists) {
    return (
      <Card>
        <SectionTitle>Price Validation Engine</SectionTitle>
        <p className="text-xs text-white/[0.36]">
          No feed created yet. Run <code className="text-[#B084E9]">npm run flow:mainnet</code> to
          bootstrap the pilot feed.
        </p>
      </Card>
    )
  }

  const statusColor = feed.paused
    ? 'bg-red-500/20 text-red-400'
    : feed.tradable
      ? 'bg-emerald-500/20 text-emerald-400'
      : 'bg-amber-500/20 text-amber-400'
  const statusLabel = feed.paused ? 'Paused' : feed.tradable ? 'Live' : 'Stale'

  return (
    <Card>
      <SectionTitle action={<Badge color={statusColor}>{statusLabel}</Badge>}>
        {feed.description || 'Price Feed'}
      </SectionTitle>

      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-semibold tabular-nums">
          {feed.price ? formatUnits18(feed.price, 2) : '—'}
        </span>
        <span className="text-xs text-white/[0.36]">
          median of {Number(feed.sourceCount ?? 0)} accepted source
          {Number(feed.sourceCount) === 1 ? '' : 's'}
        </span>
      </div>
      <p className="text-[11px] text-white/[0.3] mb-5">
        validated {timeAgo(feed.validatedAt)} · {formatNumber(feed.validationCount ?? 0)} rounds
        all-time
      </p>

      {/* The rules every quote must clear, read from the on-chain RiskConfig */}
      {feed.risk && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <RiskCell label="Max deviation" value={formatBps(feed.risk.maxDeviationBps)} />
          <RiskCell label="Max spread" value={formatBps(feed.risk.maxSpreadBps)} />
          <RiskCell label="Max staleness" value={formatDuration(feed.risk.maxStaleness)} />
          <RiskCell label="Min depth" value={`$${formatUnits18(feed.risk.minDepth, 0)}`} />
          <RiskCell label="Min sources" value={String(feed.risk.minSources)} />
          <RiskCell label="Min source kinds" value={String(feed.risk.minDistinctKinds)} />
        </div>
      )}

      <SectionTitle>Sources</SectionTitle>
      <div className="space-y-2">
        {quotes.length === 0 && (
          <p className="text-xs text-white/[0.3]">No sources registered on this feed yet.</p>
        )}
        {quotes.map(({ source, quote }) => (
          <SourceRow key={source.reporter} source={source} quote={quote} risk={feed.risk} />
        ))}
      </div>

      {/* Running a validation round is permissionless: no role, no bond, just
          gas. It is the cheapest way for anyone to participate meaningfully,
          and it is what keeps the feed alive if our keeper ever stops. */}
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] text-white/[0.54]">Run a validation round</p>
            <p className="text-[10px] text-white/[0.3] mt-0.5">
              Anyone can trigger this — no permission needed. The contract re-checks every
              source and publishes the median.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!isConnected || validate.isBusy}
            onClick={async () => {
              const rc = await validate.execute({ args: [feedId] })
              if (rc) refetch()
            }}
          >
            {validate.status === 'simulating' && 'Checking…'}
            {validate.status === 'signing' && 'Confirm…'}
            {validate.status === 'pending' && 'Validating…'}
            {!validate.isBusy && (isConnected ? 'Validate' : 'Connect to validate')}
          </Button>
        </div>
        {validate.error && <p className="mt-2 text-[11px] text-[#F5618B]">{validate.error}</p>}
        {validate.explorerUrl && (
          <a
            href={validate.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[11px] text-[#B084E9]"
          >
            View your transaction ↗
          </a>
        )}
      </div>
    </Card>
  )
}

/**
 * One price source. The verdict mirrors the exact checks
 * PriceValidationEngine._screenQuote runs on-chain, so the UI and the contract
 * cannot disagree about why a source was dropped.
 */
function SourceRow({ source, quote, risk }) {
  const kind = SOURCE_KIND[Number(source.kind)] ?? 'UNKNOWN'
  const verdict = screenQuote(quote, risk)

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium truncate">{source.name}</span>
          <Badge color="bg-[#B084E9]/12 text-[#B084E9]">{SOURCE_KIND_LABEL[kind] ?? kind}</Badge>
          {!source.active && <Badge color="bg-gray-500/20 text-gray-400">Disabled</Badge>}
        </div>
        <p className="text-[10px] text-white/[0.3] mt-0.5 font-mono">
          {shortAddress(source.reporter)}
        </p>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-xs tabular-nums">{quote?.price ? formatUnits18(quote.price, 2) : '—'}</p>
        <p className={`text-[10px] ${verdict.color}`}>{verdict.label}</p>
      </div>
    </div>
  )
}

function screenQuote(quote, risk) {
  if (!quote || !risk || quote.observedAt === 0n) {
    return { label: 'No quote', color: 'text-white/30' }
  }

  const age = Math.floor(Date.now() / 1000) - Number(quote.observedAt)
  if (age > Number(risk.maxStaleness)) return { label: 'Stale', color: 'text-[#F5618B]' }
  if (quote.depth < risk.minDepth) return { label: 'Thin', color: 'text-[#F5618B]' }

  // A zero bid/ask means a one-sided print (e.g. a NAV) — no spread to check.
  const twoSided = quote.bid > 0n && quote.ask > 0n
  if (twoSided) {
    const mid = (quote.bid + quote.ask) / 2n
    if (mid > 0n) {
      const spreadBps = ((quote.ask - quote.bid) * 10000n) / mid
      if (spreadBps > BigInt(risk.maxSpreadBps)) {
        return { label: 'Wide spread', color: 'text-[#F5618B]' }
      }
    }
  }
  return { label: 'Accepted', color: 'text-[#29E9A9]' }
}

/* ─── Markets, with live seasoning progress ─────────────────────────────── */

function MarketsPanel({ onNavigate }) {
  const { markets, isLoading } = useAllMarkets()

  return (
    <Card>
      <SectionTitle
        action={
          <Button size="sm" variant="ghost" onClick={() => onNavigate('create-listing')}>
            + Propose
          </Button>
        }
      >
        Markets
      </SectionTitle>

      {isLoading && <Skeleton lines={3} />}
      {!isLoading && markets.length === 0 && (
        <p className="text-xs text-white/[0.3]">
          No markets yet. Anyone can propose one — no committee approves it.
        </p>
      )}

      <div className="space-y-2">
        {markets.map(({ marketId, market }) => {
          const status = MARKET_STATUS[Number(market.status)] ?? 'Unknown'
          return (
            <div
              key={marketId}
              className="py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{market.config.orderlySymbol}</span>
                <Badge color={MARKET_STATUS_COLOR[status] ?? 'bg-white/10 text-white/50'}>
                  {status}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/[0.36]">
                <span>{Number(market.config.maxLeverage)}x max</span>
                <span>IM {formatBps(market.config.initialMarginBps)}</span>
                <span>MM {formatBps(market.config.maintenanceMarginBps)}</span>
              </div>
              {status === 'Proposed' && <SeasoningBar marketId={marketId} />}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * A proposed market is not "awaiting review" — it is seasoning. This bar makes
 * the permissionless listing thesis visible: the contract, not a reviewer,
 * decides when the market may go live, and anyone can then activate it.
 */
function SeasoningBar({ marketId }) {
  const { progress } = useMarket(marketId)
  if (!progress) return null

  const elapsed = Number(progress.elapsed)
  const required = Number(progress.seasoningRequired)
  const observed = Number(progress.validationsObserved)
  const needed = Number(progress.validationsRequired)

  return (
    <div className="mt-2 space-y-1.5">
      <div>
        <div className="flex justify-between text-[10px] text-white/[0.3] mb-1">
          <span>Seasoning time</span>
          <span>
            {formatDuration(Math.min(elapsed, required))} / {formatDuration(required)}
          </span>
        </div>
        <ProgressBar value={elapsed} max={required} />
      </div>
      <div>
        <div className="flex justify-between text-[10px] text-white/[0.3] mb-1">
          <span>Clean validations</span>
          <span>
            {observed} / {needed}
          </span>
        </div>
        <ProgressBar value={observed} max={needed} />
      </div>
      {progress.ready && (
        <p className="text-[10px] text-[#29E9A9]">Ready — anyone can activate this market now.</p>
      )}
    </div>
  )
}

/* ─── Registered assets ─────────────────────────────────────────────────── */

function AssetsPanel() {
  const { assets, isLoading } = useAllAssets()

  return (
    <Card>
      <SectionTitle>Registered Assets</SectionTitle>
      {isLoading && <Skeleton lines={2} />}
      {!isLoading && assets.length === 0 && (
        <p className="text-xs text-white/[0.3]">No assets registered yet.</p>
      )}
      <div className="space-y-2">
        {assets.map(({ assetId, asset }) => {
          const status = ASSET_STATUS[Number(asset.status)] ?? 'Unknown'
          return (
            <div
              key={assetId}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                <p className="text-[10px] text-white/[0.3]">
                  {asset.symbol} · {ASSET_CLASS[Number(asset.class)] ?? '—'}
                </p>
              </div>
              <Badge
                color={
                  status === 'Active'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : status === 'Suspended'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400'
                }
              >
                {status}
              </Badge>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/* ─── Small pieces ──────────────────────────────────────────────────────── */

function StatCard({ title, value, sub, color = '', highlight, loading }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 border ${
        highlight
          ? 'bg-[#B084E9]/[0.06] border-[#B084E9]/20'
          : 'bg-[rgba(12,13,16,0.8)] border-white/[0.06]'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/[0.3] mb-1">{title}</p>
      {loading ? (
        <div className="h-6 w-16 rounded bg-white/[0.06] animate-pulse" />
      ) : (
        <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
      )}
      {sub && <p className="text-[10px] text-white/[0.3] mt-0.5">{sub}</p>}
    </div>
  )
}

function RiskCell({ label, value }) {
  return (
    <div className="rounded-lg px-2.5 py-2 bg-white/[0.02] border border-white/[0.04]">
      <p className="text-[9px] uppercase tracking-wider text-white/[0.3]">{label}</p>
      <p className="text-[11px] tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
      ))}
    </div>
  )
}
