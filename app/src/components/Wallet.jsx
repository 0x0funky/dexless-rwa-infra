import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { bsc } from 'wagmi/chains'
import { useState } from 'react'
import { Button } from './UI'
import { chainName, SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from '../lib/wagmi'
import { isDeployed, shortAddress } from '../lib/contracts'

/** Network pill — turns red when the wallet is on a chain we have no contracts on. */
export function NetworkBadge() {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { isConnected } = useAccount()

  const supported = SUPPORTED_CHAINS.includes(chainId)
  const deployed = isDeployed(chainId)

  if (isConnected && !supported) {
    return (
      <button
        onClick={() => switchChain?.({ chainId: DEFAULT_CHAIN_ID })}
        className="text-[10px] text-[#F5618B] bg-[rgba(245,97,139,0.12)] px-3 py-1 rounded-full border border-[#F5618B]/20 hover:bg-[rgba(245,97,139,0.2)] transition-all cursor-pointer"
      >
        Wrong network — switch to BNB Chain
      </button>
    )
  }

  return (
    <span
      className={`text-[10px] px-3 py-1 rounded-full border ${
        deployed
          ? 'text-white/[0.3] bg-white/[0.04] border-white/[0.06]'
          : 'text-[#FFD146] bg-[rgba(255,209,70,0.1)] border-[#FFD146]/20'
      }`}
      title={deployed ? undefined : 'No contracts deployed on this chain yet'}
    >
      {chainName(chainId)}
      {!deployed && ' — not deployed'}
    </span>
  )
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!isConnected) {
    const injected = connectors[0]
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-[10px] text-[#F5618B] max-w-[200px] truncate" title={error.message}>
            {error.message}
          </span>
        )}
        <Button
          size="sm"
          onClick={() => connect({ connector: injected })}
          disabled={isPending || !injected}
        >
          {isPending ? 'Connecting…' : 'Connect Wallet'}
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2 bg-white/[0.05] px-3 py-1.5 rounded-xl cursor-pointer hover:bg-white/[0.08] transition-all border border-white/[0.06]"
      >
        <span className="w-[6px] h-[6px] rounded-full bg-[#29E9A9]" />
        <span className="text-[11px] font-medium text-white/[0.54]">{shortAddress(address)}</span>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 bg-[rgba(12,13,16,0.97)] backdrop-blur-[20px] border border-white/[0.08] rounded-xl p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[160px]">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(address)
                setMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-[11px] text-white/[0.54] hover:text-white hover:bg-white/[0.05] rounded-lg transition-all"
            >
              Copy address
            </button>
            <button
              onClick={() => {
                disconnect()
                setMenuOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-[11px] text-[#F5618B] hover:bg-[rgba(245,97,139,0.1)] rounded-lg transition-all"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Blocks a page when the wallet is not connected. */
export function RequireWallet({ children }) {
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()

  if (isConnected) return children

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm text-white/[0.54] mb-1">Connect your wallet to continue</p>
      <p className="text-xs text-white/[0.3] mb-5">
        DEXless runs on BNB Chain. All actions are on-chain transactions.
      </p>
      <Button onClick={() => connect({ connector: connectors[0] })}>Connect Wallet</Button>
    </div>
  )
}

/** Shown when the connected chain has no deployment yet. */
export function RequireDeployment({ children }) {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  if (isDeployed(chainId)) return children

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-sm text-white/[0.54] mb-1">No DEXless deployment on {chainName(chainId)}</p>
      <p className="text-xs text-white/[0.3] mb-5 max-w-sm">
        Deploy the contracts and run <code className="text-[#B084E9]">npx ts-node scripts/export-abi.ts</code> to
        publish the addresses to this app.
      </p>
      <Button variant="secondary" onClick={() => switchChain?.({ chainId: bsc.id })}>
        Switch to BNB Chain
      </Button>
    </div>
  )
}
