import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { bsc } from 'wagmi/chains'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from './UI'
import { chainName, SUPPORTED_CHAINS, DEFAULT_CHAIN_ID } from '../lib/wagmi'
import { isDeployed } from '../lib/contracts'

/**
 * Wallet surfaces.
 *
 * RainbowKit owns the connect modal — it covers the cases a hand-rolled injected
 * button cannot: WalletConnect QR for a desktop visitor holding a phone wallet,
 * deep links into wallet apps on mobile, and a real picker when several
 * extensions are installed. The custom render props below keep the trigger
 * looking like the rest of the product rather than a third-party widget.
 */

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

  // Purely informational once everything is correct, so it steps aside on a
  // phone to leave room for the connect button. A problem state still shows.
  return (
    <span
      className={`text-[10px] px-3 py-1 rounded-full border whitespace-nowrap ${
        deployed
          ? 'text-white/[0.3] bg-white/[0.04] border-white/[0.06] hidden sm:inline'
          : 'text-[#FFD146] bg-[rgba(255,209,70,0.1)] border-[#FFD146]/20'
      }`}
      title={deployed ? undefined : 'No contracts deployed on this chain yet'}
    >
      {chainName(chainId)}
      {!deployed && ' — not deployed'}
    </span>
  )
}

/** Header trigger: opens RainbowKit's modal, styled as our own button. */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        const connected = ready && account && chain

        return (
          <div
            aria-hidden={!ready}
            style={ready ? undefined : { opacity: 0, pointerEvents: 'none', userSelect: 'none' }}
          >
            {!connected ? (
              <Button size="sm" onClick={openConnectModal}>
                Connect Wallet
              </Button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="text-[11px] font-medium text-[#F5618B] bg-[rgba(245,97,139,0.12)] px-3 py-1.5 rounded-xl border border-[#F5618B]/20 hover:bg-[rgba(245,97,139,0.2)] transition-all"
              >
                切換到 BNB Chain
              </button>
            ) : (
              <button
                onClick={openAccountModal}
                className="flex items-center gap-2 bg-white/[0.05] px-3 py-1.5 rounded-xl cursor-pointer hover:bg-white/[0.08] transition-all border border-white/[0.06]"
              >
                <span className="w-[6px] h-[6px] rounded-full bg-[#29E9A9]" />
                <span className="text-[11px] font-medium text-white/[0.54]">
                  {account.displayName}
                </span>
              </button>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

/** Blocks a page until a wallet is connected. */
export function RequireWallet({ children }) {
  const { isConnected } = useAccount()

  if (isConnected) return children

  return (
    <div className="flex flex-col items-center justify-center py-20 px-5">
      <p className="text-sm text-white/[0.7] mb-1">連接錢包以繼續</p>
      <p className="text-xs text-white/[0.36] mb-6 text-center max-w-[420px]">
        DEXless 運行於 BNB Chain,所有操作都是鏈上交易。
        手機請用錢包 App 掃描 QR code,或直接在錢包內建瀏覽器開啟本站。
      </p>
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => (
          <Button onClick={openConnectModal} disabled={!mounted}>
            Connect Wallet
          </Button>
        )}
      </ConnectButton.Custom>
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
