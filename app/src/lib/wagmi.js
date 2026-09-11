import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { bsc, bscTestnet, hardhat } from 'wagmi/chains'

/**
 * BNB Chain only in production. A local Hardhat node can be put in front for
 * development by setting VITE_DEV_CHAIN=localhost — useful for previewing the
 * dashboard against populated state before anything is deployed for real.
 *
 * RainbowKit's getDefaultConfig bundles the injected connectors together with
 * WalletConnect, which is what makes a phone able to connect at all: a mobile
 * browser has no injected provider, so without WalletConnect the only route in
 * is a wallet's own in-app browser.
 */
const useLocal = import.meta.env.DEV && import.meta.env.VITE_DEV_CHAIN === 'localhost'

// wagmi treats chains[0] as the chain to read from before a wallet connects, so
// the preferred chain has to lead the list — that is what makes the dashboard
// show real data to a visitor who has not connected anything yet.
const preferred = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID || (useLocal ? hardhat.id : bsc.id))
const all = useLocal ? [hardhat, bsc, bscTestnet] : [bsc, bscTestnet]
const ordered = [
  ...all.filter((c) => c.id === preferred),
  ...all.filter((c) => c.id !== preferred),
]

// A WalletConnect project id is a public identifier, not a secret — it ships in
// the bundle by design, the same way a Stripe publishable key does.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

export const config = getDefaultConfig({
  appName: 'DEXless',
  appDescription: 'Permissionless RWA market creation on BNB Chain',
  appUrl: 'https://app-kappa-woad-34.vercel.app',
  projectId,
  chains: ordered,
  transports: {
    [bsc.id]: http(import.meta.env.VITE_BSC_RPC || 'https://bsc-dataseed.bnbchain.org'),
    [bscTestnet.id]: http(
      import.meta.env.VITE_BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
    ),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
  ssr: false,
})

export const SUPPORTED_CHAINS = ordered.map((c) => c.id)
export const DEFAULT_CHAIN_ID = preferred

export function chainName(chainId) {
  if (chainId === bsc.id) return 'BNB Chain'
  if (chainId === bscTestnet.id) return 'BNB Chain Testnet'
  if (chainId === hardhat.id) return 'Local Node'
  return `Chain ${chainId}`
}
