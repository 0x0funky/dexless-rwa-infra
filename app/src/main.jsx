import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'
import App from './App.jsx'
import { config } from './lib/wagmi'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Contract state is polled by the individual hooks; keep retries low so a
      // reverting view call surfaces quickly instead of hanging the UI.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Match the app's own palette rather than shipping RainbowKit's defaults, so the
// connect modal reads as part of the product instead of a bolted-on widget.
const theme = darkTheme({
  accentColor: '#B084E9',
  accentColorForeground: '#0C0D10',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" initialChain={undefined}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
