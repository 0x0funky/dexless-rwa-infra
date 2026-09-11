import { createConfig, http } from 'wagmi'
import { bsc, bscTestnet, hardhat } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

/**
 * BNB Chain only in production. A local Hardhat node can be put in front for
 * development by setting VITE_DEV_CHAIN=localhost — useful for previewing the
 * dashboard against populated state before anything is deployed for real.
 */
const useLocal = import.meta.env.DEV && import.meta.env.VITE_DEV_CHAIN === 'localhost'

// wagmi treats chains[0] as the chain to read from before a wallet connects, so
// the preferred chain has to lead the list — that is what makes the dashboard
// show real data to a visitor who has not connected anything yet.
const preferred = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID || (useLocal ? hardhat.id : bsc.id))
const all = useLocal ? [hardhat, bsc, bscTestnet] : [bsc, bscTestnet]
const chains = [
  ...all.filter((c) => c.id === preferred),
  ...all.filter((c) => c.id !== preferred),
]

export const config = createConfig({
  chains,
  connectors: [injected()],
  transports: {
    [bsc.id]: http(import.meta.env.VITE_BSC_RPC || 'https://bsc-dataseed.bnbchain.org'),
    [bscTestnet.id]: http(
      import.meta.env.VITE_BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'
    ),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
})

export const SUPPORTED_CHAINS = chains.map((c) => c.id)
export const DEFAULT_CHAIN_ID = preferred

export function chainName(chainId) {
  if (chainId === bsc.id) return 'BNB Chain'
  if (chainId === bscTestnet.id) return 'BNB Chain Testnet'
  if (chainId === hardhat.id) return 'Local Node'
  return `Chain ${chainId}`
}
