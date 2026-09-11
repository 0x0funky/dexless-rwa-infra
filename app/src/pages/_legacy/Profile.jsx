import { useState } from 'react'
import { Card, Button, Input, SectionTitle, Badge, ProgressBar } from '../components/UI'

export default function Profile() {
  const [kycStatus] = useState('verified') // 'not_started' | 'pending' | 'verified'

  return (
    <div className="p-5 max-w-[700px] mx-auto animate-fade-in">
      <h2 className="text-lg font-semibold mb-1">Profile & Identity</h2>
      <p className="text-xs text-white/40 mb-6">Manage your identity verification and account settings</p>

      {/* Wallet */}
      <Card className="mb-5">
        <SectionTitle>Connected Wallet</SectionTitle>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B084E9] to-[#894CD1] flex items-center justify-center text-xs font-bold">
              B
            </div>
            <div>
              <span className="text-sm font-mono font-medium">0x7a3f...9e2b</span>
              <span className="text-[10px] text-white/30 block">Arbitrum One</span>
            </div>
          </div>
          <Badge color="bg-emerald-500/20 text-emerald-400">Connected</Badge>
        </div>
      </Card>

      {/* KYC Status */}
      <Card className="mb-5">
        <SectionTitle>Identity Verification (KYC)</SectionTitle>

        {kycStatus === 'verified' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#29E9A9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-semibold text-emerald-400">Verified</span>
                <span className="text-[10px] text-white/40 block">Completed on Mar 15, 2026</span>
              </div>
            </div>
            <p className="text-[11px] text-white/40">
              Your identity has been verified. You can list assets on the platform.
            </p>
          </div>
        ) : kycStatus === 'pending' ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-amber-400">Under Review</span>
            </div>
            <p className="text-[11px] text-white/40">Your documents are being reviewed. This usually takes 24-48 hours.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-white/40">
              Complete identity verification to list assets on Dexless. Required for all asset issuers.
            </p>

            <div className="space-y-3">
              <KYCStep num={1} title="Personal Information" desc="Name, date of birth, nationality" status="pending" />
              <KYCStep num={2} title="ID Document" desc="Passport, driver's license, or national ID" status="locked" />
              <KYCStep num={3} title="Proof of Address" desc="Utility bill or bank statement (last 3 months)" status="locked" />
              <KYCStep num={4} title="Selfie Verification" desc="Live photo holding your ID document" status="locked" />
            </div>

            <Button className="w-full">Start Verification</Button>
          </div>
        )}
      </Card>

      {/* Notification Preferences */}
      <Card className="mb-5">
        <SectionTitle>Notifications</SectionTitle>
        <div className="space-y-3">
          <NotifRow label="Listing status updates" checked />
          <NotifRow label="New token holder alerts" checked />
          <NotifRow label="Yield distribution reminders" checked />
          <NotifRow label="Platform announcements" checked={false} />
        </div>
      </Card>

      {/* Telegram */}
      <Card>
        <SectionTitle>Telegram Alerts</SectionTitle>
        <div className="space-y-3">
          <Input label="Chat ID" placeholder="-100xxxxxxxxxx" defaultValue="-1001234567890" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-white/50">Connected</span>
          </div>
          <div className="bg-white/[0.04] rounded-lg p-3 text-[11px] text-white/35 space-y-1">
            <p>1. Add <span className="text-[#B084E9]">@DexlessAlertBot</span> to your Telegram group</p>
            <p>2. Send <span className="font-mono">/start</span> in the group</p>
            <p>3. Enter your Chat ID above</p>
          </div>
          <Button size="sm">Save</Button>
        </div>
      </Card>
    </div>
  )
}

function KYCStep({ num, title, desc, status }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      status === 'complete' ? 'border-emerald-500/20 bg-emerald-500/5' :
      status === 'pending' ? 'border-[#B084E9]/20 bg-[#B084E9]/5' :
      'border-white/[0.06] bg-white/[0.02] opacity-50'
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
        status === 'complete' ? 'bg-emerald-500/20 text-emerald-400' :
        status === 'pending' ? 'bg-[#B084E9]/20 text-[#B084E9]' :
        'bg-white/[0.06] text-white/25'
      }`}>
        {status === 'complete' ? '✓' : num}
      </div>
      <div>
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-white/30 block">{desc}</span>
      </div>
    </div>
  )
}

function NotifRow({ label, checked }) {
  const [on, setOn] = useState(checked)
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/60">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={`w-9 h-5 rounded-full transition-colors relative ${on ? 'bg-[#B084E9]' : 'bg-white/10'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
