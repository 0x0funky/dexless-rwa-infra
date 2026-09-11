import { useState, useCallback } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProposeMarket from './pages/ProposeMarket'
import NotWired from './pages/NotWired'

/**
 * There is no client-side data store: every page reads chain state directly
 * through the hooks in `src/hooks/useDexless.js`. Navigation is the only thing
 * held in App state.
 */
function App() {
  const [page, setPage] = useState({ name: 'dashboard', params: null })

  const navigate = useCallback((name, params = null) => {
    setPage({ name, params })
    document.querySelector('main')?.scrollTo(0, 0)
  }, [])

  const renderPage = () => {
    switch (page.name) {
      case 'dashboard':
        return <Dashboard onNavigate={navigate} />

      case 'create-listing':
        return <ProposeMarket onNavigate={navigate} />

      case 'my-assets':
        return (
          <NotWired
            onNavigate={navigate}
            title="My Assets"
            contract="RWAToken · FeeDistributor"
            todo={[
              'Token balance, backing ratio, and redemption via requestRedemption()',
              'Claimable distribution rounds with Merkle proofs from the IPFS snapshot',
              'Markets proposed by the connected wallet, with bond status',
            ]}
          />
        )

      case 'profile':
        return (
          <NotWired
            onNavigate={navigate}
            title="Profile & KYC"
            contract="ComplianceRegistry"
            todo={[
              'Show attestation: tier, jurisdiction, issue and expiry dates',
              'Warn ahead of attestation expiry',
              'Link to the KYC provider flow for unverified wallets',
            ]}
          />
        )

      default:
        return <Dashboard onNavigate={navigate} />
    }
  }

  return (
    <Layout currentPage={page.name} onNavigate={navigate}>
      {renderPage()}
    </Layout>
  )
}

export default App
