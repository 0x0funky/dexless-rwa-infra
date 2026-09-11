import { useMemo, useState } from 'react'
import { useChainId } from 'wagmi'
import { formatEther, parseEther, parseUnits } from 'viem'
import { Badge, BackButton, Button, Card, Checkbox, Input, SectionTitle } from '../components/UI'
import { RequireDeployment, RequireWallet } from '../components/Wallet'
import { useAllAssets, useAllFeeds, useMarketBounds, useMarket } from '../hooks/useDexless'
import { useActivateMarket, useProposeMarket } from '../hooks/useDexlessWrite'
import {
  ASSET_CLASS,
  ASSET_STATUS,
  SOURCE_KIND,
  SOURCE_KIND_LABEL,
  formatBps,
  formatDuration,
  formatUnits18,
  timeAgo,
  txUrl,
} from '../lib/contracts'

const STEPS = [
  { num: 1, label: 'Asset' },
  { num: 2, label: 'Price feed' },
  { num: 3, label: 'Market rules' },
  { num: 4, label: 'Review' },
]

/**
 * Propose a permissionless RWA perp market.
 *
 * The form mirrors the contract's own admission rules rather than a listing
 * application: every constraint shown here is read from MarketFactory.bounds()
 * on-chain, and the submit button is disabled by the same checks the contract
 * will run. A proposal that would revert can't be signed.
 */
export default function ProposeMarket({ onNavigate }) {
  return (
    <RequireDeployment>
      <RequireWallet>
        <Inner onNavigate={onNavigate} />
      </RequireWallet>
    </RequireDeployment>
  )
}

function Inner({ onNavigate }) {
  const chainId = useChainId()
  const [step, setStep] = useState(1)

  const { assets, isLoading: assetsLoading } = useAllAssets()
  const { feeds, isLoading: feedsLoading } = useAllFeeds()
  const { bounds } = useMarketBounds()

  const [assetId, setAssetId] = useState(null)
  const [feedId, setFeedId] = useState(null)
  const [leverage, setLeverage] = useState('10')
  const [imBps, setImBps] = useState('1000')
  const [mmBps, setMmBps] = useState('500')
  const [tickSize, setTickSize] = useState('0.01')
  const [minOrder, setMinOrder] = useState('0.01')
  const [symbol, setSymbol] = useState('')
  const [ack, setAck] = useState(false)
  const [proposedId, setProposedId] = useState(null)

  const propose = useProposeMarket()

  const asset = assets.find((a) => a.assetId === assetId) ?? null
  const feed = feeds.find((f) => f.feedId === feedId) ?? null

  // Mirror MarketFactory._checkConfig so the UI refuses what the contract would.
  const configErrors = useMemo(() => {
    if (!bounds) return []
    const errs = []
    const lev = Number(leverage)
    const im = Number(imBps)
    const mm = Number(mmBps)

    if (!lev || lev < 1) errs.push('Leverage must be at least 1x')
    else if (lev > Number(bounds.maxLeverageCap)) errs.push(`Leverage cannot exceed ${bounds.maxLeverageCap}x`)

    if (im < Number(bounds.minInitialMarginBps))
      errs.push(`Initial margin must be at least ${formatBps(bounds.minInitialMarginBps)}`)
    if (im > 10000) errs.push('Initial margin cannot exceed 100%')
    if (mm < Number(bounds.minMaintenanceMarginBps))
      errs.push(`Maintenance margin must be at least ${formatBps(bounds.minMaintenanceMarginBps)}`)
    if (mm >= im) errs.push('Maintenance margin must be below initial margin')

    if (!Number(tickSize)) errs.push('Tick size is required')
    if (!Number(minOrder)) errs.push('Minimum order size is required')
    if (!symbol.trim()) errs.push('Market symbol is required')

    return errs
  }, [bounds, leverage, imBps, mmBps, tickSize, minOrder, symbol])

  const canSubmit =
    assetId && feedId && configErrors.length === 0 && ack && bounds && !propose.isBusy

  async function submit() {
    const config = {
      maxLeverage: Number(leverage),
      initialMarginBps: Number(imBps),
      maintenanceMarginBps: Number(mmBps),
      tickSize: parseUnits(tickSize || '0', 18),
      minOrderSize: parseUnits(minOrder || '0', 18),
      orderlySymbol: symbol.trim(),
    }

    const rc = await propose.execute({
      args: [assetId, feedId, config],
      value: bounds.bondAmount,
    })
    if (rc) setProposedId(await computeId(assetId, feedId))
  }

  // The factory derives the id itself; recompute it locally to follow the
  // proposal without another round trip.
  async function computeId(a, f) {
    const { keccak256, encodePacked } = await import('viem')
    return keccak256(encodePacked(['bytes32', 'bytes32'], [a, f]))
  }

  if (proposedId) {
    return <Submitted marketId={proposedId} propose={propose} onNavigate={onNavigate} />
  }

  return (
    <div className="p-6 max-w-[980px] mx-auto animate-fade-in">
      <BackButton onClick={() => (step === 1 ? onNavigate('dashboard') : setStep(step - 1))}
        label={step === 1 ? 'Dashboard' : STEPS[step - 2].label} />

      <h1 className="text-xl font-semibold mb-1">Propose a Market</h1>
      <p className="text-xs text-white/[0.36] mb-5 max-w-[62ch]">
        Anyone can propose. Nobody approves it — the market has to prove its price feed stays
        healthy, then any address can activate it.
      </p>

      <Stepper step={step} />

      {step === 1 && (
        <StepCard
          title="Choose a registered asset"
          desc="Only assets with a fresh custody attestation can back a market."
        >
          {assetsLoading && <Muted>Loading assets…</Muted>}
          {!assetsLoading && assets.length === 0 && (
            <Muted>
              No assets registered yet. An asset must be registered and have custody attested
              before a market can reference it.
            </Muted>
          )}
          <div className="space-y-2">
            {assets.map(({ assetId: id, asset: a }) => {
              const status = ASSET_STATUS[Number(a.status)]
              const selectable = status === 'Active'
              return (
                <SelectRow
                  key={id}
                  selected={assetId === id}
                  disabled={!selectable}
                  onClick={() => selectable && setAssetId(id)}
                  title={a.name}
                  subtitle={`${a.symbol} · ${ASSET_CLASS[Number(a.class)]}`}
                  right={
                    <Badge
                      color={
                        selectable
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }
                    >
                      {status}
                    </Badge>
                  }
                />
              )
            })}
          </div>
          <StepNav onNext={() => setStep(2)} nextDisabled={!assetId} />
        </StepCard>
      )}

      {step === 2 && (
        <StepCard
          title="Choose a price feed"
          desc="The feed must already be producing validated prices — a cold feed cannot back a market."
        >
          {feedsLoading && <Muted>Loading feeds…</Muted>}
          {!feedsLoading && feeds.length === 0 && <Muted>No price feeds exist yet.</Muted>}
          <div className="space-y-2">
            {feeds.map((f) => (
              <FeedRow
                key={f.feedId}
                feed={f}
                selected={feedId === f.feedId}
                onClick={() => f.tradable && setFeedId(f.feedId)}
              />
            ))}
          </div>
          <StepNav onNext={() => setStep(3)} nextDisabled={!feedId} />
        </StepCard>
      )}

      {step === 3 && (
        <StepCard
          title="Market rules"
          desc="Every value is checked against the factory's global bounds on submit."
        >
          {bounds && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
              <Limit label="Max leverage" value={`${bounds.maxLeverageCap}x`} />
              <Limit label="Min initial margin" value={formatBps(bounds.minInitialMarginBps)} />
              <Limit label="Min maint. margin" value={formatBps(bounds.minMaintenanceMarginBps)} />
              <Limit label="Bond (refundable)" value={`${formatEther(bounds.bondAmount)} BNB`} />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Market symbol" placeholder="PERP_XAU_USDC" value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
            <Input label="Max leverage" suffix="x" type="number" value={leverage}
              onChange={(e) => setLeverage(e.target.value)} />
            <Input label="Initial margin" suffix="bps" type="number" value={imBps}
              onChange={(e) => setImBps(e.target.value)} />
            <Input label="Maintenance margin" suffix="bps" type="number" value={mmBps}
              onChange={(e) => setMmBps(e.target.value)} />
            <Input label="Tick size" type="number" step="0.0001" value={tickSize}
              onChange={(e) => setTickSize(e.target.value)} />
            <Input label="Minimum order size" type="number" step="0.0001" value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)} />
          </div>

          {configErrors.length > 0 && (
            <div className="mt-4 space-y-1">
              {configErrors.map((e) => (
                <p key={e} className="text-[11px] text-[#F5618B]">{e}</p>
              ))}
            </div>
          )}

          <StepNav onNext={() => setStep(4)} nextDisabled={configErrors.length > 0} />
        </StepCard>
      )}

      {step === 4 && (
        <StepCard title="Review and submit" desc="This sends a transaction and locks the bond.">
          <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.06]">
            <Row label="Asset" value={asset ? `${asset.asset.name} (${asset.asset.symbol})` : '—'} />
            <Row label="Price feed" value={feed?.description ?? '—'} />
            <Row label="Latest validated price"
              value={feed?.price ? formatUnits18(feed.price, 2) : '—'} />
            <Row label="Market symbol" value={symbol || '—'} />
            <Row label="Max leverage" value={`${leverage}x`} />
            <Row label="Initial / maintenance margin"
              value={`${formatBps(imBps)} / ${formatBps(mmBps)}`} />
            <Row label="Tick / min size" value={`${tickSize} / ${minOrder}`} />
            <Row label="Bond" value={bounds ? `${formatEther(bounds.bondAmount)} BNB` : '—'}
              highlight />
          </div>

          {bounds && (
            <div className="mt-4 rounded-xl bg-[#B084E9]/[0.07] border border-[#B084E9]/20 px-4 py-3">
              <p className="text-[11px] text-white/[0.7] leading-relaxed">
                After submitting, this market must season for{' '}
                <b className="text-white">{formatDuration(bounds.seasoningPeriod)}</b> and its feed
                must pass <b className="text-white">{String(bounds.requiredValidations)}</b> clean
                validation rounds. Then <b className="text-white">any address</b> can activate it.
                The bond is returned in full whether it activates or is rejected.
              </p>
            </div>
          )}

          <div className="mt-4">
            <Checkbox
              checked={ack}
              onChange={setAck}
              label="I understand this sends an on-chain transaction and locks the bond until the proposal resolves."
            />
          </div>

          {propose.error && (
            <p className="mt-3 text-[11px] text-[#F5618B]">{propose.error}</p>
          )}

          <div className="flex items-center gap-3 mt-5">
            <Button onClick={submit} disabled={!canSubmit}>
              {propose.status === 'simulating' && 'Checking…'}
              {propose.status === 'signing' && 'Confirm in wallet…'}
              {propose.status === 'pending' && 'Submitting…'}
              {!propose.isBusy && 'Propose market'}
            </Button>
            {propose.explorerUrl && (
              <a href={propose.explorerUrl} target="_blank" rel="noreferrer"
                className="text-[11px] text-[#B084E9]">View transaction ↗</a>
            )}
          </div>
        </StepCard>
      )}
    </div>
  )
}

/* ─── After submission: live seasoning + permissionless activation ───────── */

function Submitted({ marketId, propose, onNavigate }) {
  const chainId = useChainId()
  const { market, progress, refetch } = useMarket(marketId)
  const activate = useActivateMarket()

  const elapsed = Number(progress?.elapsed ?? 0)
  const required = Number(progress?.seasoningRequired ?? 1)
  const observed = Number(progress?.validationsObserved ?? 0)
  const needed = Number(progress?.validationsRequired ?? 1)
  const isActive = market && Number(market.status) === 2

  return (
    <div className="p-6 max-w-[720px] mx-auto animate-fade-in">
      <BackButton onClick={() => onNavigate('dashboard')} label="Dashboard" />

      <Card>
        <SectionTitle
          action={
            <Badge color={isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
              {isActive ? 'Active' : 'Seasoning'}
            </Badge>
          }
        >
          {isActive ? 'Market is live' : 'Proposal submitted'}
        </SectionTitle>

        <p className="text-xs text-white/[0.54] mb-5">
          {isActive
            ? 'The market passed its seasoning requirements and has been activated.'
            : 'No one reviews this proposal. It activates once the feed has proven itself.'}
        </p>

        {propose.explorerUrl && (
          <a href={propose.explorerUrl} target="_blank" rel="noreferrer"
            className="text-[11px] text-[#B084E9] block mb-5">Proposal transaction ↗</a>
        )}

        {!isActive && (
          <div className="space-y-4">
            <Meter label="Seasoning time" value={Math.min(elapsed, required)} max={required}
              display={`${formatDuration(Math.min(elapsed, required))} / ${formatDuration(required)}`} />
            <Meter label="Clean validations" value={observed} max={needed}
              display={`${observed} / ${needed}`} />
          </div>
        )}

        {progress?.ready && !isActive && (
          <div className="mt-5">
            <p className="text-[11px] text-[#29E9A9] mb-3">
              Requirements met. Any address can activate this market — it does not have to be yours.
            </p>
            <Button
              onClick={async () => {
                const rc = await activate.execute({ args: [marketId] })
                if (rc) refetch()
              }}
              disabled={activate.isBusy}
            >
              {activate.isBusy ? 'Activating…' : 'Activate market'}
            </Button>
            {activate.error && <p className="mt-2 text-[11px] text-[#F5618B]">{activate.error}</p>}
          </div>
        )}

        {activate.hash && (
          <a href={txUrl(chainId, activate.hash)} target="_blank" rel="noreferrer"
            className="text-[11px] text-[#B084E9] block mt-3">Activation transaction ↗</a>
        )}

        {!progress?.ready && !isActive && (
          <p className="mt-5 text-[10px] text-white/[0.3]">
            Progress refreshes automatically. The keeper must keep publishing prices for the
            validation count to rise.
          </p>
        )}
      </Card>
    </div>
  )
}

/* ─── Pieces ────────────────────────────────────────────────────────────── */

function Stepper({ step }) {
  return (
    <div className="bg-[rgba(12,13,16,0.8)] border border-white/[0.06] rounded-2xl p-5 mb-5 flex items-center justify-center">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${
                step === s.num
                  ? 'bg-[#B084E9] text-[#0C0D10]'
                  : step > s.num
                    ? 'bg-[#29E9A9] text-[#0C0D10]'
                    : 'bg-white/[0.06] text-white/30'
              }`}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${
                step === s.num ? 'text-[#B084E9]' : step > s.num ? 'text-[#29E9A9]' : 'text-white/30'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 h-px mx-1 mt-[-16px] ${step > s.num ? 'bg-[#29E9A9]' : 'bg-white/[0.08]'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function StepCard({ title, desc, children }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      <p className="text-[11px] text-white/[0.36] mb-5">{desc}</p>
      {children}
    </Card>
  )
}

function StepNav({ onNext, nextDisabled }) {
  return (
    <div className="mt-5 flex justify-end">
      <Button onClick={onNext} disabled={nextDisabled}>Continue</Button>
    </div>
  )
}

function SelectRow({ selected, disabled, onClick, title, subtitle, right }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left flex items-center justify-between py-3 px-4 rounded-xl border transition-all ${
        selected
          ? 'border-[#B084E9]/50 bg-[#B084E9]/[0.08]'
          : disabled
            ? 'border-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed'
            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{title}</p>
        <p className="text-[10px] text-white/[0.36] mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-shrink-0 ml-3">{right}</div>
    </button>
  )
}

function FeedRow({ feed, selected, onClick }) {
  const kinds = [...new Set((feed.sources ?? []).map((s) => SOURCE_KIND[Number(s.kind)]))]
  return (
    <SelectRow
      selected={selected}
      disabled={!feed.tradable}
      onClick={onClick}
      title={feed.description}
      subtitle={
        feed.tradable
          ? `${formatUnits18(feed.price, 2)} · ${feed.sources?.length ?? 0} sources (${kinds
              .map((k) => SOURCE_KIND_LABEL[k] ?? k)
              .join(', ')}) · validated ${timeAgo(feed.validatedAt)}`
          : feed.paused
            ? 'Paused — cannot back a market'
            : 'No fresh validated price'
      }
      right={
        <Badge
          color={
            feed.tradable
              ? 'bg-emerald-500/20 text-emerald-400'
              : feed.paused
                ? 'bg-red-500/20 text-red-400'
                : 'bg-amber-500/20 text-amber-400'
          }
        >
          {feed.tradable ? 'Live' : feed.paused ? 'Paused' : 'Stale'}
        </Badge>
      }
    />
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[11px] text-white/[0.36]">{label}</span>
      <span className={`text-xs tabular-nums ${highlight ? 'text-[#B084E9] font-semibold' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function Limit({ label, value }) {
  return (
    <div className="rounded-lg px-2.5 py-2 bg-white/[0.02] border border-white/[0.04]">
      <p className="text-[9px] uppercase tracking-wider text-white/[0.3]">{label}</p>
      <p className="text-[11px] tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function Meter({ label, value, max, display }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100)
  return (
    <div>
      <div className="flex justify-between text-[10px] text-white/[0.36] mb-1.5">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </div>
      <div className="w-full h-[4px] rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-[#29E9A9]' : 'bg-[#B084E9]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Muted({ children }) {
  return <p className="text-xs text-white/[0.3]">{children}</p>
}
