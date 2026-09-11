// ─── Dexless UI Primitives ───
// Follows Dexless design: glassmorphic cards, pill buttons w/ gradient, cyan accent on focus

export function Modal({ open, onClose, title, children, width = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative ${width} w-full mx-4 bg-[rgba(12,13,16,0.95)] backdrop-blur-[20px] border border-white/[0.08] rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-fade-in`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-lg leading-none">&times;</button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Button({ children, variant = 'primary', size = 'md', disabled, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all whitespace-nowrap cursor-pointer'
  const sizes = {
    sm: 'text-[11px] px-4 h-[30px]',
    md: 'text-[13px] px-5 h-[36px]',
    lg: 'text-[13px] px-6 h-[40px]',
  }
  const variants = {
    primary: 'rounded-[50px] text-white bg-gradient-to-r from-[#7053F3] via-[#78CBC1] to-[#CDEB78] hover:shadow-[0_4px_12px_rgba(127,251,255,0.3)] hover:-translate-y-px',
    secondary: 'rounded-[50px] bg-[rgba(12,13,16,1)] border border-white/[0.15] text-white/60 hover:text-white hover:border-white/30',
    outline: 'rounded-[50px] border border-[#B084E9]/40 text-[#B084E9] hover:bg-[#B084E9]/10',
    ghost: 'rounded-lg text-white/50 hover:text-white hover:bg-white/[0.05]',
    danger: 'rounded-[50px] bg-[rgba(245,97,139,0.15)] text-[#F5618B] border border-[#F5618B]/20 hover:bg-[rgba(245,97,139,0.25)]',
    brand: 'rounded-[50px] bg-[#6e55df] text-white hover:bg-[#7d66e8]',
  }
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? '!opacity-40 !cursor-not-allowed !bg-[rgb(68,61,69)] !text-white/40 !shadow-none !translate-y-0 !border-transparent' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

export function Input({ label, suffix, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs text-white/[0.36] mb-1.5 font-medium">{label}</label>}
      <div className="relative">
        <input
          className={`w-full bg-[rgba(12,13,16,0.6)] border ${error ? 'border-[#F5618B]/50' : 'border-white/[0.08]'} rounded-xl px-3 h-10 text-sm text-white/90 placeholder-white/[0.3] focus:outline-none focus:border-[rgba(127,251,255,0.2)] transition-all`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/[0.36]">{suffix}</span>
        )}
      </div>
      {error && <p className="text-[#F5618B] text-[11px] mt-1">{error}</p>}
    </div>
  )
}

export function Badge({ children, color = 'bg-white/10 text-white/50' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${color}`}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, max }) {
  const pct = Math.min(100, (value / max) * 100)
  const barColor = pct >= 100 ? 'bg-[#29E9A9]' : pct >= 60 ? 'bg-[#B084E9]' : 'bg-[#FFD146]'
  return (
    <div className="w-full h-[3px] rounded-full bg-white/[0.05] overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`bg-[rgba(12,13,16,0.8)] backdrop-blur-[20px] border border-white/[0.06] rounded-2xl p-4 sm:p-5 min-w-0 transition-all duration-300 ${onClick ? 'cursor-pointer hover:bg-[rgba(36,32,47,0.8)] hover:border-[rgba(127,251,255,0.12)]' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#B084E9]">{children}</h3>
      {action}
    </div>
  )
}

export function BackButton({ onClick, label = 'Back' }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-xs text-white/[0.36] hover:text-white transition-colors mb-4">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </button>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.04]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
            active === tab.id
              ? 'bg-[#B084E9]/15 text-[#B084E9]'
              : 'text-white/[0.36] hover:text-white/60'
          }`}
        >
          {tab.label}
          {tab.complete != null && (
            <span className={`ml-1.5 text-[9px] ${tab.complete ? 'text-[#29E9A9]' : ''}`}>
              {tab.complete ? '\u2713' : ''}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function RadioGroup({ options, value, onChange, name }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <label
          key={opt}
          className={`px-3.5 py-2 text-xs font-medium rounded-[50px] border cursor-pointer transition-all ${
            value === opt
              ? 'border-[#B084E9]/50 bg-[#B084E9]/12 text-[#B084E9]'
              : 'border-white/[0.08] text-white/[0.36] hover:border-white/[0.15] hover:text-white/60'
          }`}
        >
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="sr-only" />
          {opt}
        </label>
      ))}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-[0.36] cursor-not-allowed' : ''}`}>
      <div
        className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-all flex-shrink-0 ${
          checked ? 'bg-[#B084E9] border-[#B084E9]' : 'border-white/[0.15] bg-transparent'
        }`}
        onClick={disabled ? undefined : (e) => { e.preventDefault(); onChange(!checked) }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {label && <span className="text-xs text-white/[0.54]">{label}</span>}
    </label>
  )
}
