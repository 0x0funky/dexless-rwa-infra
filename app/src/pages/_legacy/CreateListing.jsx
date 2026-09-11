import { useState, useCallback } from 'react'
import { Card, Button, Input, BackButton, Modal, Checkbox, RadioGroup } from '../components/UI'
import Icon from '../components/Icons'
import {
  ASSET_CATEGORIES, VALUATION_METHODS, TOKEN_STANDARDS,
  JURISDICTIONS, INVESTOR_TYPES, formatCurrency,
} from '../data/mockData'

// ─── Source list (Figma) ───
const ALL_SOURCES = [
  'Binance', 'OKX', 'Bybit', 'Gate.io', 'KuCoin', 'Coinbase',
  'MEXC', 'Bitget', 'BingX', 'HyperLiquid', 'LBank', 'Pyth', 'Stork',
]

const STEPS = [
  { num: 1, label: 'Asset Info' },
  { num: 2, label: 'Token Config' },
  { num: 3, label: 'Compliance' },
  { num: 4, label: 'Price Sources' },
  { num: 5, label: 'Trading Params' },
  { num: 6, label: 'Review' },
]

export default function CreateListing({ onNavigate, onSubmit }) {
  const [step, setStep] = useState(1)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // ── Step 1: Asset Info ──
  const [category, setCategory] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetDesc, setAssetDesc] = useState('')
  const [valuationMethod, setValuationMethod] = useState('')
  const [totalValuation, setTotalValuation] = useState('')
  const [documents, setDocuments] = useState([])
  const [yieldRate, setYieldRate] = useState('')
  const [yieldFreq, setYieldFreq] = useState('')

  // ── Step 2: Token Config ──
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenStandard, setTokenStandard] = useState('erc20')
  const [totalSupply, setTotalSupply] = useState('')
  const [currency, setCurrency] = useState('USDC')

  // ── Step 3: Compliance ──
  const [jurisdiction, setJurisdiction] = useState('')
  const [investorType, setInvestorType] = useState('open')
  const [lockupDays, setLockupDays] = useState('')
  const [compliance, setCompliance] = useState({ terms: false, legal: false, kyc: false })

  // ── Step 4: Symbol Search ──
  const [baseSymbol, setBaseSymbol] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [selectedSources, setSelectedSources] = useState([])

  // ── Step 5: Trading Params ──
  const [maxLeverage, setMaxLeverage] = useState('10x')
  const [globalMaxOI, setGlobalMaxOI] = useState('')
  const [maxNotionalUser, setMaxNotionalUser] = useState('')
  const [fundingPeriod, setFundingPeriod] = useState('8h')
  const [liquidationFee, setLiquidationFee] = useState('0.015')
  const [claimDiscount, setClaimDiscount] = useState('0.0075')

  // ── Derived values ──
  const pricePerToken = totalSupply && totalValuation ? (Number(totalValuation) / Number(totalSupply)).toFixed(4) : '--'
  const step1Valid = category && assetName && valuationMethod && totalValuation
  const step2Valid = tokenSymbol && totalSupply && Number(totalSupply) > 0
  const step3Valid = jurisdiction && compliance.terms && compliance.legal && compliance.kyc
  const leverageNum = parseInt(maxLeverage)
  const imr = leverageNum ? (1 / leverageNum) : 0
  const mmr = imr / 2

  const addDocument = () => {
    const name = prompt('Document name (e.g. "Ownership Certificate")')
    if (name) setDocuments([...documents, name])
  }

  const handleSearch = useCallback(() => {
    if (!baseSymbol.trim()) return
    setSearching(true)
    setSearchResults(null)
    setSelectedSources([])
    setTimeout(() => {
      const key = baseSymbol.trim().toUpperCase()
      const basePrice = +(Math.random() * 200 + 0.5).toFixed(5)
      const results = ALL_SOURCES.map((name) => {
        const isCEX = !['Pyth', 'Stork'].includes(name)
        const jitter = 1 + (Math.random() - 0.5) * 0.01
        return {
          name,
          type: isCEX ? 'CEX' : 'Oracle',
          symbol: isCEX ? `${key}_USDT` : `${key}/USD`,
          found: true,
          price: +(basePrice * jitter).toFixed(5),
          volume24h: Math.floor(Math.random() * 100000000 + 1000000),
        }
      })
      setSearchResults(results)
      setSearching(false)
    }, 800)
  }, [baseSymbol])

  const toggleSource = (name) => {
    setSelectedSources((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name)
      if (prev.length >= 5) return prev
      return [...prev, name]
    })
  }

  const handleFinalSubmit = () => {
    setSubmitted(true)
    if (onSubmit) {
      const selectedSourceData = searchResults?.filter((s) => selectedSources.includes(s.name)) || []
      const avgPrice = selectedSourceData.reduce((sum, s) => sum + (s.price || 0), 0) / (selectedSourceData.length || 1)
      onSubmit({
        id: `rwa-${Date.now()}`,
        name: assetName || `PERP_${baseSymbol}_USDC`,
        category: category || 'equity',
        status: 'PENDING_REVIEW',
        issuer: '0x7a3f...9e2b',
        issuerName: 'Self',
        tokenSymbol: tokenSymbol || `PERP_${baseSymbol}_USDC`,
        totalSupply: Number(totalSupply) || 1000000,
        pricePerToken: +avgPrice.toFixed(2) || +(pricePerToken) || 0,
        totalValuation: Number(totalValuation) || Math.round(avgPrice * 1000000),
        valuationMethod: valuationMethod || 'oracle',
        tokenStandard,
        currency,
        createdAt: new Date().toISOString(),
        description: assetDesc || `Permissionless listing for ${baseSymbol}.`,
        documents,
        metrics: { holders: 0, volume24h: 0, traded: 0, liquidity: 0 },
        yield: { annual: Number(yieldRate) || 0, frequency: yieldFreq || 'N/A', lastPayout: null },
        sources: selectedSourceData,
        alertLevel: 'normal',
        params: { maxLeverage: leverageNum, globalMaxOI: globalMaxOI ? +globalMaxOI : null, maxNotionalUser: +maxNotionalUser, fundingPeriod, liquidationFee: +liquidationFee, claimDiscount: +claimDiscount },
      })
    }
  }

  return (
    <div className="p-5 max-w-[1100px] mx-auto animate-fade-in">
      <h1 className="text-[16px] font-semibold tracking-[0.4px] mb-5">Listing dashboard</h1>

      {/* ═══ STEPPER ═══ */}
      <div className="bg-[#16171c] border-[0.8px] border-[#23252b] rounded-xl p-5 mb-5 flex items-center justify-center">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <button
              onClick={() => s.num < step && setStep(s.num)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${
                step === s.num ? 'bg-[#DBFD5C] text-[#0C0D10]'
                : step > s.num ? 'bg-[#29E9A9] text-[#0C0D10] cursor-pointer'
                : 'bg-[#23252b] text-white/30'
              }`}>
                {step > s.num ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : s.num}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                step === s.num ? 'text-[#DBFD5C]' : step > s.num ? 'text-[#29E9A9]' : 'text-white/30'
              }`}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-px mx-1 mt-[-16px] ${step > s.num ? 'bg-[#29E9A9]' : 'bg-[#23252b]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Asset Info ═══ */}
      {step === 1 && (
        <StepWrapper
          title="Asset Information"
          desc="Describe the real-world asset you want to tokenize and list."
          onBack={() => onNavigate('dashboard')}
          onNext={() => setStep(2)}
          nextDisabled={!step1Valid}
          nextLabel="Next: Token Config"
        >
          <div>
            <label className="block text-xs text-white/50 mb-2.5 font-medium">Asset Category *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ASSET_CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${category === cat.id ? 'border-[rgba(112,83,243,0.5)] bg-[rgba(112,83,243,0.1)]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}>
                  <div className="w-7 h-7 rounded-lg bg-[rgba(112,83,243,0.1)] flex items-center justify-center text-[#B084E9]">
                    <Icon name={cat.icon} size={15} />
                  </div>
                  <h4 className="text-xs font-semibold mt-1.5">{cat.label}</h4>
                  <p className="text-[10px] text-white/30 mt-0.5">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <Input label="Asset Name *" placeholder='e.g. "Taipei 101 Office Unit #3201"' value={assetName} onChange={(e) => setAssetName(e.target.value)} />
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium">Description</label>
            <textarea className="w-full bg-[rgba(12,13,16,0.6)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[rgba(127,251,255,0.2)] transition-colors min-h-[80px] resize-y" placeholder="Describe the asset..." value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} />
          </div>
          <FormCard title="Valuation">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {VALUATION_METHODS.map((m) => (
                <button key={m.id} onClick={() => setValuationMethod(m.id)}
                  className={`p-3 rounded-lg border text-left transition-all text-xs ${valuationMethod === m.id ? 'border-[rgba(112,83,243,0.4)] bg-[rgba(112,83,243,0.1)]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                  <span className="font-semibold">{m.label}</span>
                  <p className="text-[10px] text-white/30 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
            <Input label="Total Asset Valuation (USD) *" type="number" placeholder="1,500,000" value={totalValuation} onChange={(e) => setTotalValuation(e.target.value)} suffix="USD" />
          </FormCard>
          <FormCard title="Supporting Documents">
            <p className="text-[10px] text-white/30 mb-3">Upload ownership certificates, appraisal reports, etc.</p>
            {documents.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-white/[0.54]"><Icon name="doc" size={14} />{doc}</span>
                    <button onClick={() => setDocuments(documents.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" variant="secondary" onClick={addDocument}>+ Add Document</Button>
          </FormCard>
          <FormCard title="Yield / Income (Optional)">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Annual Yield (%)" type="number" placeholder="5.2" value={yieldRate} onChange={(e) => setYieldRate(e.target.value)} suffix="%" />
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-medium">Distribution Frequency</label>
                <RadioGroup options={['Monthly', 'Quarterly', 'Semi-annual', 'Annual']} value={yieldFreq} onChange={setYieldFreq} name="yield-freq" />
              </div>
            </div>
          </FormCard>
        </StepWrapper>
      )}

      {/* ═══ STEP 2: Token Config ═══ */}
      {step === 2 && (
        <StepWrapper title="Token Configuration" desc="Define how your asset will be represented on-chain." onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!step2Valid} nextLabel="Next: Compliance">
          <div>
            <label className="block text-xs text-white/50 mb-2.5 font-medium">Token Standard *</label>
            <div className="space-y-2">
              {TOKEN_STANDARDS.map((ts) => (
                <button key={ts.id} onClick={() => setTokenStandard(ts.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${tokenStandard === ts.id ? 'border-[rgba(112,83,243,0.4)] bg-[rgba(112,83,243,0.1)]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{ts.label}</span>
                    {tokenStandard === ts.id && <span className="text-[#B084E9] text-xs">Selected</span>}
                  </div>
                  <p className="text-[10px] text-white/30 mt-0.5">{ts.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Token Symbol *" placeholder="e.g. TP101-3201" value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())} />
            <Input label="Total Supply *" type="number" placeholder="10,000" value={totalSupply} onChange={(e) => setTotalSupply(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2 font-medium">Quote Currency</label>
            <RadioGroup options={['USDC', 'USDT', 'DAI']} value={currency} onChange={setCurrency} name="currency" />
          </div>
        </StepWrapper>
      )}

      {/* ═══ STEP 3: Compliance ═══ */}
      {step === 3 && (
        <StepWrapper title="Compliance & Legal" desc="Set investor restrictions and confirm regulatory compliance." onBack={() => setStep(2)} onNext={() => setStep(4)} nextDisabled={!step3Valid} nextLabel="Next: Price Sources">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">Jurisdiction *</label>
              <select className="w-full bg-[rgba(12,13,16,0.6)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(127,251,255,0.2)] transition-colors appearance-none" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
                <option value="">Select jurisdiction...</option>
                {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <Input label="Lock-up Period (Days)" type="number" placeholder="0 = no lock-up" value={lockupDays} onChange={(e) => setLockupDays(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2.5 font-medium">Investor Restrictions</label>
            <div className="grid grid-cols-2 gap-2">
              {INVESTOR_TYPES.map((t) => (
                <button key={t.id} onClick={() => setInvestorType(t.id)}
                  className={`p-3 rounded-lg border text-left transition-all text-xs ${investorType === t.id ? 'border-[rgba(112,83,243,0.4)] bg-[rgba(112,83,243,0.1)]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                  <span className="font-semibold">{t.label}</span>
                  <p className="text-[10px] text-white/30 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <FormCard title="Required Confirmations">
            <div className="space-y-3">
              <Checkbox checked={compliance.kyc} onChange={(v) => setCompliance({ ...compliance, kyc: v })} label="I have completed identity verification (KYC/KYB)" />
              <Checkbox checked={compliance.legal} onChange={(v) => setCompliance({ ...compliance, legal: v })} label="I confirm I have legal authority to tokenize this asset" />
              <Checkbox checked={compliance.terms} onChange={(v) => setCompliance({ ...compliance, terms: v })} label="I agree to Dexless Platform Terms and RWA Listing Agreement" />
            </div>
          </FormCard>
        </StepWrapper>
      )}

      {/* ═══ STEP 4: Symbol Search & Sources ═══ */}
      {step === 4 && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(3)} className="text-white/40 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div>
                <h2 className="text-[14px] font-semibold">Step 4 : Symbol Search & Sources</h2>
                <p className="text-xs text-white/50">Enter base symbol to search various CEX/Oracle sources. Please check at least 1 source.</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" disabled={selectedSources.length === 0} onClick={() => setStep(5)}>Next</Button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-[280px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="w-full bg-[#16171c] border-[0.8px] border-[#23252b] rounded-xl pl-9 pr-3 h-10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[rgba(112,83,243,0.6)] transition-colors" placeholder="e.g. BTC, ETH, SOL" value={baseSymbol} onChange={(e) => setBaseSymbol(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            </div>
            <Button size="sm" onClick={handleSearch} disabled={!baseSymbol.trim() || searching}>Search</Button>
            <div className="flex-1" />
            <span className="text-xs text-white/40">Selected: <span className="text-white font-semibold">{selectedSources.length}</span> / 5</span>
          </div>

          <div className="border-[0.8px] border-[#23252b] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#23252b]">
                  <th className="w-10 px-4 py-3 text-left"><Checkbox checked={searchResults && selectedSources.length === searchResults.filter((s) => s.found).slice(0, 5).length} onChange={(checked) => { if (checked && searchResults) { setSelectedSources(searchResults.filter((s) => s.found).slice(0, 5).map((s) => s.name)) } else { setSelectedSources([]) } }} disabled={!searchResults} /></th>
                  <th className="px-4 py-3 text-left text-white/50 font-medium">Source</th>
                  <th className="px-4 py-3 text-left text-white/50 font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-white/50 font-medium">Source symbol</th>
                  <th className="px-4 py-3 text-left text-white/50 font-medium">Price multiplier</th>
                  <th className="px-4 py-3 text-right text-white/50 font-medium">Latest price</th>
                  <th className="px-4 py-3 text-right text-white/50 font-medium">24h volume</th>
                  <th className="px-4 py-3 text-right text-white/50 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {(searchResults || ALL_SOURCES.map((name) => ({ name, type: ['Pyth', 'Stork'].includes(name) ? 'Oracle' : 'CEX', symbol: '', found: false, price: null, volume24h: null }))).map((src) => (
                  <tr key={src.name} className="border-t border-[#23252b]/60 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5"><Checkbox checked={selectedSources.includes(src.name)} onChange={() => toggleSource(src.name)} disabled={!src.found && !searchResults} /></td>
                    <td className="px-4 py-2.5 text-white font-medium">{src.name}</td>
                    <td className="px-4 py-2.5 text-white/60">{src.type}</td>
                    <td className="px-4 py-2.5">{src.symbol ? <span className="bg-[#23252b] text-white/80 text-[11px] px-2.5 py-1 rounded inline-block font-medium">{src.symbol}</span> : <span className="text-white/20">--</span>}</td>
                    <td className="px-4 py-2.5">{src.found ? <span className="bg-[#23252b] text-white/60 text-[11px] px-2 py-1 rounded inline-flex items-center gap-1">1x <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></span> : <span className="text-white/20">--</span>}</td>
                    <td className="px-4 py-2.5 text-right text-white font-medium">{src.price ? `$${src.price.toFixed(2)}` : '$0.00'}</td>
                    <td className="px-4 py-2.5 text-right text-white/80">{src.volume24h ? `$${src.volume24h.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00'}</td>
                    <td className="px-4 py-2.5 text-right text-white/80">{selectedSources.includes(src.name) ? `${(100 / selectedSources.length).toFixed(2)}%` : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {searching && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-[#DBFD5C] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-white/50">Searching sources for {baseSymbol}...</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 5: Trading Params ═══ */}
      {step === 5 && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(4)} className="text-white/40 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div>
                <h2 className="text-[14px] font-semibold">Step 5 : Trading Parameters</h2>
                <p className="text-xs text-white/50">Configure leverage, margin rate, and funding rate rules for this Symbol.</p>
              </div>
            </div>
            <Button size="sm" disabled={!maxNotionalUser} onClick={() => setStep(6)}>Next: Review</Button>
          </div>

          {/* AI Helper */}
          <div className="bg-[#16171c] border-[0.8px] border-[#23252b] rounded-xl p-4 mb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/80 mb-1">Need help with these parameters?</p>
                <p className="text-[11px] text-white/40 max-w-lg">Configuring a new pair can be complex. Copy your current setup to an AI assistant like ChatGPT or Claude to review your risk model.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(`Symbol: PERP_${baseSymbol}_USDC\nLeverage: ${maxLeverage}\nFunding: ${fundingPeriod}`)}>Copy for LLM</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
            <FormCard title="Set up parameters" subtitle="Fields marked with * are required." action={<Button size="sm" variant="secondary">Import</Button>}>
              <div className="space-y-5">
                <div>
                  <label className="block text-xs text-white/50 mb-2 font-medium">Max Leverage</label>
                  <RadioGroup options={['5x', '10x', '20x']} value={maxLeverage} onChange={setMaxLeverage} name="leverage" />
                  <p className="text-[10px] text-white/30 mt-1.5">Suggested: 10x</p>
                </div>
                <div><Input label="Global Max OI (USDC)" type="number" placeholder="1000000" value={globalMaxOI} onChange={(e) => setGlobalMaxOI(e.target.value)} /><p className="text-[10px] text-white/30 mt-1">Suggested: $1,000,000 (Optional)</p></div>
                <div><Input label="Max Notional User (USDC) *" type="number" placeholder="200000" value={maxNotionalUser} onChange={(e) => setMaxNotionalUser(e.target.value)} /><p className="text-[10px] text-white/30 mt-1">Suggested: $200,000</p></div>
                <div>
                  <label className="block text-xs text-white/50 mb-2 font-medium">Funding Period</label>
                  <RadioGroup options={['1h', '4h', '8h']} value={fundingPeriod} onChange={setFundingPeriod} name="funding" />
                  <p className="text-[10px] text-white/30 mt-1.5">Suggested: 8h</p>
                </div>
                <div><Input label="Standard liquidation fee" type="number" step="0.001" value={liquidationFee} onChange={(e) => setLiquidationFee(e.target.value)} /><p className="text-[10px] text-white/30 mt-1">{`Suggested: 0.015 (≤10x: 0.024)`}</p></div>
                <div><Input label="Claim IF discount" type="number" step="0.001" value={claimDiscount} onChange={(e) => setClaimDiscount(e.target.value)} /><p className="text-[10px] text-white/30 mt-1">{`Suggested: 0.75% (≤10x: 1.0%)`}</p></div>
              </div>
            </FormCard>

            {/* Preview */}
            <div className="lg:sticky lg:top-5 self-start">
              <div className="bg-[#16171c] border-[0.8px] border-[#23252b] rounded-xl p-5">
                <h3 className="text-[11px] font-bold text-[#DBFD5C] uppercase tracking-[0.15em] mb-4">Preview</h3>
                <div className="space-y-2 text-xs">
                  <PRow label="Symbol" value={`PERP_${baseSymbol}_USDC`} highlight />
                  <PreviewSection title="Leverage">
                    <PRow label="Leverage" value={maxLeverage} />
                    <PRow label="IMR / MMR" value={`${(imr * 100).toFixed(2)}% / ${(mmr * 100).toFixed(2)}%`} />
                    <PRow label="Max OI" value={globalMaxOI ? Number(globalMaxOI).toLocaleString() : '--'} />
                    <PRow label="Max Notional" value={maxNotionalUser ? Number(maxNotionalUser).toLocaleString() : '--'} />
                    <PRow label="Price Range" value="±5.0%" />
                  </PreviewSection>
                  <PreviewSection title="Funding">
                    <PRow label="Period" value={fundingPeriod} />
                    <PRow label="Cap" value="3%" />
                    <PRow label="Floor" value="-3%" />
                  </PreviewSection>
                  <PreviewSection title="Liquidation">
                    <PRow label="Fee" value={liquidationFee} />
                    <PRow label="Claim fee" value={claimDiscount} />
                  </PreviewSection>
                  <PreviewSection title="Tick Size">
                    <PRow label="Quote tick" value="0.0001" />
                    <PRow label="Base tick" value="0.001" />
                    <PRow label="Base min" value="0.001" />
                    <PRow label="Base max" value="100,000" />
                  </PreviewSection>
                  <div className="border-t border-white/[0.06] pt-2 mt-2">
                    <span className="text-white/40 text-[11px] font-medium">Data sources ({selectedSources.length})</span>
                    <div className="mt-1 space-y-0.5">
                      {searchResults?.filter((s) => selectedSources.includes(s.name)).map((src) => (
                        <div key={src.name} className="flex justify-between text-[11px]">
                          <span className="text-white/70">{src.name}</span>
                          <span className="text-white/40 font-mono">{src.symbol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(4)}>Back</Button>
                <Button className="flex-1" disabled={!maxNotionalUser} onClick={() => setStep(6)}>Next: Review</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 6: Review ═══ */}
      {step === 6 && (
        <StepWrapper title="Review & Submit" desc="Double-check everything before submitting." onBack={() => setStep(5)} onNext={() => setSubmitOpen(true)} nextLabel="Submit Listing">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <FormCard title="Asset Information" action={<button onClick={() => setStep(1)} className="text-[10px] text-[#DBFD5C] hover:underline">Edit</button>}>
              <div className="space-y-2 text-xs">
                <PRow label="Category" value={ASSET_CATEGORIES.find((c) => c.id === category)?.label || '--'} />
                <PRow label="Name" value={assetName || '--'} />
                <PRow label="Valuation" value={totalValuation ? formatCurrency(Number(totalValuation)) : '--'} />
                <PRow label="Documents" value={`${documents.length} uploaded`} />
              </div>
            </FormCard>
            <FormCard title="Token Configuration" action={<button onClick={() => setStep(2)} className="text-[10px] text-[#DBFD5C] hover:underline">Edit</button>}>
              <div className="space-y-2 text-xs">
                <PRow label="Symbol" value={tokenSymbol || '--'} highlight />
                <PRow label="Standard" value={TOKEN_STANDARDS.find((t) => t.id === tokenStandard)?.label || '--'} />
                <PRow label="Supply" value={totalSupply ? Number(totalSupply).toLocaleString() : '--'} />
                <PRow label="Price/Token" value={pricePerToken !== '--' ? `$${pricePerToken}` : '--'} />
              </div>
            </FormCard>
            <FormCard title="Compliance" action={<button onClick={() => setStep(3)} className="text-[10px] text-[#DBFD5C] hover:underline">Edit</button>}>
              <div className="space-y-2 text-xs">
                <PRow label="Jurisdiction" value={jurisdiction || '--'} />
                <PRow label="Investor Access" value={INVESTOR_TYPES.find((t) => t.id === investorType)?.label || '--'} />
                <PRow label="Lock-up" value={lockupDays ? `${lockupDays} days` : 'None'} />
              </div>
            </FormCard>
            <FormCard title="Trading Parameters" action={<button onClick={() => setStep(5)} className="text-[10px] text-[#DBFD5C] hover:underline">Edit</button>}>
              <div className="space-y-2 text-xs">
                <PRow label="Symbol" value={`PERP_${baseSymbol}_USDC`} highlight />
                <PRow label="Leverage" value={maxLeverage} />
                <PRow label="Funding" value={fundingPeriod} />
                <PRow label="Sources" value={`${selectedSources.length} selected`} />
              </div>
            </FormCard>
          </div>
        </StepWrapper>
      )}

      {/* ═══ Submit Modal ═══ */}
      <Modal open={submitOpen && !submitted} onClose={() => setSubmitOpen(false)} title="Submit the listing request?">
        <div className="space-y-4">
          <div className="bg-white/[0.04] rounded-lg p-3 text-xs space-y-1.5 text-white/50">
            <p>Your listing will be submitted for processing.</p>
            <p>The market will enter POST_ONLY mode first.</p>
            <p>Auto-activates once depth threshold is maintained.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleFinalSubmit}>Confirm & Submit</Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal open={submitted} onClose={() => { setSubmitted(false); setSubmitOpen(false); onNavigate('dashboard') }}>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-[#29E9A9]/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#29E9A9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h3 className="text-base font-semibold mb-1">Listing Submitted!</h3>
          <p className="text-xs text-white/40 mb-1">{tokenSymbol || `PERP_${baseSymbol}_USDC`} — {assetName}</p>
          <p className="text-xs text-white/40 mb-5">Your RWA listing is now pending review.</p>
          <Button onClick={() => { setSubmitted(false); setSubmitOpen(false); onNavigate('dashboard') }}>Return to Dashboard</Button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Step Wrapper (shared layout for steps 1-3, 6) ───
function StepWrapper({ title, desc, onBack, onNext, nextDisabled, nextLabel = 'Next', children }) {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-white/40 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h2 className="text-[14px] font-semibold">{title}</h2>
            <p className="text-xs text-white/50">{desc}</p>
          </div>
        </div>
        <Button size="sm" disabled={nextDisabled} onClick={onNext}>{nextLabel}</Button>
      </div>
      {children}
    </div>
  )
}

function FormCard({ title, subtitle, action, children }) {
  return (
    <div className="bg-[#16171c] border-[0.8px] border-[#23252b] rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-white/80">{title}</h3>
          {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function PreviewSection({ title, children }) {
  return (
    <div className="border-t border-white/[0.06] pt-2 mt-2">
      <span className="text-white/40 text-[11px] font-medium">{title}</span>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  )
}

function PRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className={highlight ? 'font-semibold text-[#DBFD5C]' : 'font-medium'}>{value}</span>
    </div>
  )
}
