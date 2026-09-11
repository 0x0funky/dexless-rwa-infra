import { useState } from 'react'
import { Card, Button, Input, BackButton, SectionTitle, RadioGroup, Modal, Checkbox } from '../components/UI'
import Icon from '../components/Icons'
import {
  ASSET_CATEGORIES, VALUATION_METHODS, TOKEN_STANDARDS,
  JURISDICTIONS, INVESTOR_TYPES, formatCurrency,
} from '../data/mockData'

const STEPS = [
  { num: 1, label: 'Asset Info' },
  { num: 2, label: 'Token Config' },
  { num: 3, label: 'Compliance' },
  { num: 4, label: 'Review & Submit' },
]

export default function CreateListing({ onNavigate }) {
  const [step, setStep] = useState(1)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Step 1: Asset Info
  const [category, setCategory] = useState('')
  const [assetName, setAssetName] = useState('')
  const [assetDesc, setAssetDesc] = useState('')
  const [valuationMethod, setValuationMethod] = useState('')
  const [totalValuation, setTotalValuation] = useState('')
  const [documents, setDocuments] = useState([])
  const [yieldRate, setYieldRate] = useState('')
  const [yieldFreq, setYieldFreq] = useState('')

  // Step 2: Token Config
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenStandard, setTokenStandard] = useState('erc20')
  const [totalSupply, setTotalSupply] = useState('')
  const [currency, setCurrency] = useState('USDC')

  // Step 3: Compliance
  const [jurisdiction, setJurisdiction] = useState('')
  const [investorType, setInvestorType] = useState('open')
  const [lockupDays, setLockupDays] = useState('')
  const [compliance, setCompliance] = useState({ terms: false, legal: false, kyc: false })

  const pricePerToken = totalSupply && totalValuation
    ? (Number(totalValuation) / Number(totalSupply)).toFixed(4)
    : '—'

  const step1Valid = category && assetName && valuationMethod && totalValuation
  const step2Valid = tokenSymbol && totalSupply && Number(totalSupply) > 0
  const step3Valid = jurisdiction && compliance.terms && compliance.legal && compliance.kyc

  const addDocument = () => {
    const name = prompt('Document name (e.g. "Ownership Certificate")')
    if (name) setDocuments([...documents, name])
  }

  return (
    <div className="p-5 max-w-[900px] mx-auto animate-fade-in">
      <BackButton
        onClick={() => step === 1 ? onNavigate('dashboard') : setStep(step - 1)}
        label={step === 1 ? 'Dashboard' : `Step ${step - 1}`}
      />

      {/* Stepper (Figma style: circles + connecting lines) */}
      <div className="bg-[#16171c] border-[0.8px] border-[#23252b] rounded-xl p-5 mb-6 flex items-center justify-center">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <button
              onClick={() => s.num < step && setStep(s.num)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s.num
                  ? 'bg-[#DBFD5C] text-[#0C0D10]'
                  : step > s.num
                  ? 'bg-[#29E9A9] text-[#0C0D10] cursor-pointer'
                  : 'bg-[#23252b] text-white/30'
              }`}>
                {step > s.num ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : s.num}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${
                step === s.num ? 'text-[#DBFD5C]' : step > s.num ? 'text-[#29E9A9]' : 'text-white/30'
              }`}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-24 h-px mx-2 mt-[-18px] ${
                step > s.num ? 'bg-[#29E9A9]' : 'bg-[#23252b]'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* ═══ STEP 1: Asset Information ═══ */}
      {step === 1 && (
        <div className="animate-fade-in space-y-5">
          <div>
            <h2 className="text-lg font-semibold mb-1">Asset Information</h2>
            <p className="text-xs text-white/40">Describe the real-world asset you want to tokenize and list.</p>
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-xs text-white/50 mb-2.5 font-medium">Asset Category *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ASSET_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    category === cat.id
                      ? 'border-[#B084E9]/50 bg-[#B084E9]/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#B084E9]/10 flex items-center justify-center text-[#B084E9]">
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
            <textarea
              className="w-full bg-[#201532] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#B084E9] transition-colors min-h-[80px] resize-y"
              placeholder="Describe the asset, its location, condition, provenance, etc."
              value={assetDesc}
              onChange={(e) => setAssetDesc(e.target.value)}
            />
          </div>

          {/* Valuation */}
          <Card>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Valuation</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {VALUATION_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setValuationMethod(m.id)}
                  className={`p-3 rounded-lg border text-left transition-all text-xs ${
                    valuationMethod === m.id
                      ? 'border-[#B084E9]/40 bg-[#B084E9]/10'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <span className="font-semibold">{m.label}</span>
                  <p className="text-[10px] text-white/30 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
            <Input
              label="Total Asset Valuation (USD) *"
              type="number"
              placeholder="1,500,000"
              value={totalValuation}
              onChange={(e) => setTotalValuation(e.target.value)}
              suffix="USD"
            />
          </Card>

          {/* Documents */}
          <Card>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Supporting Documents</h3>
            <p className="text-[10px] text-white/30 mb-3">Upload ownership certificates, appraisal reports, insurance policies, etc.</p>
            {documents.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.04] rounded-lg px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 text-white/[0.54]">
                      <Icon name="doc" size={14} />
                      {doc}
                    </span>
                    <button onClick={() => setDocuments(documents.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" variant="secondary" onClick={addDocument}>+ Add Document</Button>
          </Card>

          {/* Yield */}
          <Card>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Yield / Income (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Annual Yield (%)" type="number" placeholder="5.2" value={yieldRate} onChange={(e) => setYieldRate(e.target.value)} suffix="%" />
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-medium">Distribution Frequency</label>
                <RadioGroup options={['Monthly', 'Quarterly', 'Semi-annual', 'Annual']} value={yieldFreq} onChange={setYieldFreq} name="yield-freq" />
              </div>
            </div>
          </Card>

          <div className="flex justify-end pt-2">
            <Button disabled={!step1Valid} onClick={() => setStep(2)}>
              Next: Token Configuration
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Token Configuration ═══ */}
      {step === 2 && (
        <div className="animate-fade-in space-y-5">
          <div>
            <h2 className="text-lg font-semibold mb-1">Token Configuration</h2>
            <p className="text-xs text-white/40">Define how your asset will be represented on-chain.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div className="space-y-5">
              {/* Token Standard */}
              <div>
                <label className="block text-xs text-white/50 mb-2.5 font-medium">Token Standard *</label>
                <div className="space-y-2">
                  {TOKEN_STANDARDS.map((ts) => (
                    <button
                      key={ts.id}
                      onClick={() => setTokenStandard(ts.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        tokenStandard === ts.id
                          ? 'border-[#B084E9]/40 bg-[#B084E9]/10'
                          : 'border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
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
            </div>

            {/* Preview */}
            <Card className="!bg-[#170B29] border-[#B084E9]/15 self-start lg:sticky lg:top-5">
              <h3 className="text-[10px] font-bold text-[#B084E9] uppercase tracking-[0.15em] mb-3">Token Preview</h3>
              <div className="space-y-2 text-xs">
                <PRow label="Asset" value={assetName || '—'} highlight />
                <PRow label="Category" value={ASSET_CATEGORIES.find((c) => c.id === category)?.label || '—'} />
                <PRow label="Standard" value={TOKEN_STANDARDS.find((t) => t.id === tokenStandard)?.label || '—'} />
                <PRow label="Symbol" value={tokenSymbol || '—'} />
                <PRow label="Supply" value={totalSupply ? Number(totalSupply).toLocaleString() : '—'} />
                <div className="border-t border-white/[0.06] my-1.5" />
                <PRow label="Valuation" value={totalValuation ? formatCurrency(Number(totalValuation)) : '—'} />
                <PRow label="Price/Token" value={pricePerToken !== '—' ? `$${pricePerToken}` : '—'} highlight />
                <PRow label="Currency" value={currency} />
                {yieldRate && <PRow label="Yield" value={`${yieldRate}% ${yieldFreq || ''}`} />}
              </div>
            </Card>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!step2Valid} onClick={() => setStep(3)}>Next: Compliance</Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Compliance ═══ */}
      {step === 3 && (
        <div className="animate-fade-in space-y-5">
          <div>
            <h2 className="text-lg font-semibold mb-1">Compliance & Legal</h2>
            <p className="text-xs text-white/40">Set investor restrictions and confirm regulatory compliance.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">Jurisdiction *</label>
              <select
                className="w-full bg-[#201532] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#B084E9] transition-colors appearance-none"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              >
                <option value="">Select jurisdiction...</option>
                {JURISDICTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <Input label="Lock-up Period (Days)" type="number" placeholder="0 = no lock-up" value={lockupDays} onChange={(e) => setLockupDays(e.target.value)} />
          </div>

          {/* Investor Restrictions */}
          <div>
            <label className="block text-xs text-white/50 mb-2.5 font-medium">Investor Restrictions</label>
            <div className="grid grid-cols-2 gap-2">
              {INVESTOR_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setInvestorType(t.id)}
                  className={`p-3 rounded-lg border text-left transition-all text-xs ${
                    investorType === t.id
                      ? 'border-[#B084E9]/40 bg-[#B084E9]/10'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <span className="font-semibold">{t.label}</span>
                  <p className="text-[10px] text-white/30 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Compliance Checkboxes */}
          <Card>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Required Confirmations</h3>
            <div className="space-y-3">
              <Checkbox
                checked={compliance.kyc}
                onChange={(v) => setCompliance({ ...compliance, kyc: v })}
                label="I have completed identity verification (KYC/KYB)"
              />
              <Checkbox
                checked={compliance.legal}
                onChange={(v) => setCompliance({ ...compliance, legal: v })}
                label="I confirm I have legal authority to tokenize this asset"
              />
              <Checkbox
                checked={compliance.terms}
                onChange={(v) => setCompliance({ ...compliance, terms: v })}
                label="I agree to Dexless Platform Terms and RWA Listing Agreement"
              />
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button disabled={!step3Valid} onClick={() => setStep(4)}>Next: Review</Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Review ═══ */}
      {step === 4 && (
        <div className="animate-fade-in space-y-5">
          <div>
            <h2 className="text-lg font-semibold mb-1">Review & Submit</h2>
            <p className="text-xs text-white/40">Double-check everything before submitting your listing.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Asset Info Review */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Asset Information</h3>
                <button onClick={() => setStep(1)} className="text-[10px] text-[#B084E9] hover:underline">Edit</button>
              </div>
              <div className="space-y-2 text-xs">
                <PRow label="Category" value={ASSET_CATEGORIES.find((c) => c.id === category)?.label || '--'} />
                <PRow label="Name" value={assetName} />
                <PRow label="Valuation" value={formatCurrency(Number(totalValuation))} />
                <PRow label="Method" value={VALUATION_METHODS.find((m) => m.id === valuationMethod)?.label} />
                <PRow label="Documents" value={`${documents.length} uploaded`} />
                {yieldRate && <PRow label="Yield" value={`${yieldRate}% ${yieldFreq}`} />}
              </div>
            </Card>

            {/* Token Config Review */}
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Token Configuration</h3>
                <button onClick={() => setStep(2)} className="text-[10px] text-[#B084E9] hover:underline">Edit</button>
              </div>
              <div className="space-y-2 text-xs">
                <PRow label="Standard" value={TOKEN_STANDARDS.find((t) => t.id === tokenStandard)?.label} />
                <PRow label="Symbol" value={tokenSymbol} highlight />
                <PRow label="Total Supply" value={Number(totalSupply).toLocaleString()} />
                <PRow label="Price/Token" value={`$${pricePerToken}`} highlight />
                <PRow label="Currency" value={currency} />
              </div>
            </Card>

            {/* Compliance Review */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Compliance</h3>
                <button onClick={() => setStep(3)} className="text-[10px] text-[#B084E9] hover:underline">Edit</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div><span className="text-white/30 block">Jurisdiction</span><span className="font-medium">{jurisdiction}</span></div>
                <div><span className="text-white/30 block">Investor Access</span><span className="font-medium">{INVESTOR_TYPES.find((t) => t.id === investorType)?.label}</span></div>
                <div><span className="text-white/30 block">Lock-up</span><span className="font-medium">{lockupDays ? `${lockupDays} days` : 'None'}</span></div>
                <div><span className="text-white/30 block">Confirmations</span><span className="text-emerald-400 font-medium">3/3 ✓</span></div>
              </div>
            </Card>
          </div>

          {/* Description preview */}
          {assetDesc && (
            <Card>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-xs text-white/60 leading-relaxed">{assetDesc}</p>
            </Card>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={() => setSubmitOpen(true)}>Submit Listing</Button>
          </div>
        </div>
      )}

      {/* ═══ Submit Confirmation Modal ═══ */}
      <Modal open={submitOpen && !submitted} onClose={() => setSubmitOpen(false)} title="Submit Listing?">
        <div className="space-y-4">
          <div className="bg-white/[0.04] rounded-lg p-3 text-xs space-y-1.5 text-white/50">
            <p>Your listing will be submitted for review.</p>
            <p>The Dexless team will verify your documents and asset information.</p>
            <p>Once approved, your token will be deployed and available for trading.</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300">
            Typical review time: 24-48 hours. You will be notified via the platform.
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => setSubmitted(true)}>Confirm & Submit</Button>
          </div>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal open={submitted} onClose={() => { setSubmitted(false); setSubmitOpen(false); onNavigate('dashboard') }}>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#29E9A9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-base font-semibold mb-1">Listing Submitted!</h3>
          <p className="text-xs text-white/40 mb-1">{tokenSymbol} — {assetName}</p>
          <p className="text-xs text-white/40 mb-5">
            Your RWA listing is now pending review. We'll notify you once it's approved.
          </p>
          <Button onClick={() => { setSubmitted(false); setSubmitOpen(false); onNavigate('my-assets') }}>
            Go to My Assets
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function PRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/35">{label}</span>
      <span className={highlight ? 'font-semibold text-[#B084E9]' : 'font-medium text-white/80'}>{value}</span>
    </div>
  )
}
