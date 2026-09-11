import { useState } from 'react'

// ─── Real Dexless Logo (D mark) ───
function DexlessIcon({ size = 16 }) {
  return (
    <svg width={size} height={size * 19 / 16} viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.1582 1.8623C15.0351 3.43328 15.9999 5.97439 16 9.39551C15.9999 15.4893 12.9396 18.7919 7.11426 18.792H0V15.7852L13.1582 1.8623ZM7.11426 0C8.46793 1.03004e-05 9.6713 0.18105 10.7227 0.53125L0 11.877V0H7.11426Z" fill="white" />
    </svg>
  )
}

// ─── Real Dexless Wordmark (DEXLESS with accent X) ───
function DexlessWordmark() {
  return (
    <svg width="114" height="16" viewBox="0 0 114 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.8242 1.04791H24.3569C28.4871 1.04791 30.7156 3.50199 30.7156 7.91933C30.7156 12.3367 28.4871 14.7907 24.3569 14.7907H18.8242V1.04791ZM22.455 11.571H23.9727C26.3356 11.571 26.9887 10.5894 26.9887 7.91933C26.9887 5.22966 26.3356 4.26766 23.9727 4.26766H22.455V11.571Z" fill="white" />
      <path d="M10.9609 1.58496C12.5255 2.92246 13.3301 5.0863 13.3301 8C13.3301 13.1885 10.7801 16 5.92676 16H0V13.4375L10.9609 1.58496ZM5.92676 0C7.05383 0 8.05612 0.15338 8.93164 0.451172L0 10.1104V0H5.92676Z" fill="white" />
      <path d="M33.3906 14.8623V1.11945H42.7462V3.98581H36.5988V6.65584H42.1699V9.20808H36.5988V11.9959H42.9383V14.8623H33.3906Z" fill="white" />
      <path d="M52.5104 7.7749L57.0826 14.8623H53.8552L50.8967 10.2879L47.9383 14.8623H44.7109L49.2831 7.7749L44.9799 1.11945H48.2073L50.8967 5.28156L53.5862 1.11945H56.8136L52.5104 7.7749Z" fill="#DBFD5C" />
      <path d="M59.4414 14.8623V1.11945H61.4393V13.0757H68.1054V14.8623H59.4414Z" fill="white" />
      <path d="M70.7578 14.8623V1.11945H79.3065V2.55263H72.3331V7.14666H78.7302V8.46204H72.3331V13.4291H79.4986V14.8623H70.7578Z" fill="white" />
      <path d="M86.9511 15.0584C83.7046 15.0584 81.918 13.3307 81.918 11.0337H83.0898C83.1859 12.8203 84.4538 14.0179 86.9704 14.0179C89.2948 14.0179 90.5435 12.8988 90.5435 11.1712C90.5435 9.54165 89.4869 8.79561 87.6235 8.42259L85.9138 8.0692C83.5125 7.57839 82.3214 6.3808 82.3214 4.5157C82.3214 2.37575 83.8775 0.942566 86.7783 0.942566C89.6214 0.942566 91.3312 2.37575 91.3312 4.41754H90.1977C90.1017 3.00399 88.9298 1.98309 86.759 1.98309C84.5882 1.98309 83.5317 3.02362 83.5317 4.5157C83.5317 5.87035 84.4346 6.73419 86.2403 7.10721L87.9501 7.46059C90.3898 7.99067 91.7538 8.99194 91.7538 11.1319C91.7538 13.5663 89.9672 15.0584 86.9511 15.0584Z" fill="white" />
      <path d="M99.2939 15.0584C95.9897 15.0584 94.4336 13.2915 94.4336 11.1515H95.2212C95.3173 12.9185 96.5852 14.2927 99.3131 14.2927C101.945 14.2927 103.174 13.0363 103.174 11.2301C103.174 9.34532 101.83 8.59929 100.043 8.2459L98.3333 7.89251C95.836 7.36243 94.837 6.10594 94.837 4.41754C94.837 2.41501 96.2202 0.942566 99.1786 0.942566C102.079 0.942566 103.578 2.39538 103.578 4.28011H102.79C102.694 2.90583 101.695 1.70824 99.1786 1.70824C96.7197 1.70824 95.6631 2.84693 95.6631 4.41754C95.6631 5.81145 96.5083 6.75382 98.6215 7.18574L100.35 7.53912C102.387 7.95141 104 8.87414 104 11.2104C104 13.5074 102.406 15.0584 99.2939 15.0584Z" fill="white" />
    </svg>
  )
}

// ─── Nav Icons ───
function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h12" />
    </svg>
  )
}
function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

import { NetworkBadge, WalletButton } from './Wallet'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: IconGrid },
  { id: 'my-assets', label: 'My Assets', icon: IconList },
  { id: 'profile', label: 'Profile & KYC', icon: IconUser },
]

export default function Layout({ currentPage, onNavigate, children }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="flex h-screen bg-[rgba(12,13,16,1)] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[64px] flex flex-col items-center py-4 bg-[rgba(12,13,16,1)] border-r border-white/[0.05] flex-shrink-0">
        {/* Real Dexless D Logo */}
        <div
          className="w-10 h-10 rounded-xl bg-[rgba(19,21,25,1)] border border-white/[0.06] flex items-center justify-center mb-8 cursor-pointer hover:border-[rgba(127,251,255,0.15)] transition-all"
          onClick={() => onNavigate('dashboard')}
        >
          <DexlessIcon size={14} />
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                currentPage === id
                  ? 'bg-[#B084E9]/15 text-[#B084E9]'
                  : 'text-white/[0.3] hover:text-white/70 hover:bg-white/[0.05]'
              }`}
            >
              <Icon />
              {hovered === id && (
                <span className="absolute left-full ml-3 px-3 py-1.5 text-[11px] bg-[rgba(12,13,16,0.95)] backdrop-blur-[20px] border border-white/[0.08] rounded-lg whitespace-nowrap z-50 font-medium shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                  {label}
                </span>
              )}
            </button>
          ))}

          {/* Create Listing CTA */}
          <button
            onClick={() => onNavigate('create-listing')}
            onMouseEnter={() => setHovered('create')}
            onMouseLeave={() => setHovered(null)}
            className="relative w-10 h-10 rounded-xl bg-gradient-to-r from-[#7053F3] via-[#78CBC1] to-[#CDEB78] text-white flex items-center justify-center hover:shadow-[0_4px_12px_rgba(127,251,255,0.3)] hover:-translate-y-px transition-all mt-3"
          >
            <IconPlus />
            {hovered === 'create' && (
              <span className="absolute left-full ml-3 px-3 py-1.5 text-[11px] bg-[rgba(12,13,16,0.95)] backdrop-blur-[20px] border border-white/[0.08] rounded-lg whitespace-nowrap z-50 font-medium shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                List New Asset
              </span>
            )}
          </button>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header with real DEXLESS wordmark */}
        <header className="h-[52px] flex items-center justify-between px-5 border-b border-white/[0.05] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="cursor-pointer" onClick={() => onNavigate('dashboard')}>
              <DexlessWordmark />
            </div>
            <span className="text-white/[0.08]">|</span>
            <span className="text-white/[0.36] text-[11px] font-medium">Permissionless Listing</span>
          </div>
          <div className="flex items-center gap-3">
            <NetworkBadge />
            <WalletButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
