import { useChainId, useReadContracts } from 'wagmi'
import { contractFor } from '../lib/contracts'

/**
 * Live reads against the deployed DEXless contracts.
 *
 * Everything the UI shows comes from chain state — there is no mock data in the
 * app. If a page renders a number, that number is on BscScan.
 */

const REFRESH_MS = 15_000

function useContracts(calls, options = {}) {
  const valid = calls.filter(Boolean)
  return useReadContracts({
    contracts: valid,
    query: {
      enabled: valid.length > 0,
      refetchInterval: options.refetchInterval ?? REFRESH_MS,
      ...options.query,
    },
  })
}

/** Protocol-wide counters for the dashboard header. */
export function useProtocolStats() {
  const chainId = useChainId()
  const engine = contractFor(chainId, 'PriceValidationEngine')
  const factory = contractFor(chainId, 'MarketFactory')
  const assets = contractFor(chainId, 'RWAAssetRegistry')
  const compliance = contractFor(chainId, 'ComplianceRegistry')

  const { data, isLoading, error, refetch } = useContracts([
    engine && { ...engine, functionName: 'feedCount' },
    engine && { ...engine, functionName: 'totalValidations' },
    engine && { ...engine, functionName: 'totalQuotesSubmitted' },
    factory && { ...factory, functionName: 'marketCount' },
    factory && { ...factory, functionName: 'activeMarkets' },
    assets && { ...assets, functionName: 'assetCount' },
    compliance && { ...compliance, functionName: 'totalAttested' },
  ])

  const v = (i) => (data?.[i]?.status === 'success' ? data[i].result : null)

  return {
    deployed: engine != null,
    isLoading,
    error,
    refetch,
    stats: {
      feeds: v(0),
      validations: v(1),
      quotes: v(2),
      markets: v(3),
      activeMarkets: v(4),
      assets: v(5),
      verifiedUsers: v(6),
    },
  }
}

/** Everything about one price feed, including its per-source quotes. */
export function useFeed(feedId) {
  const chainId = useChainId()
  const engine = contractFor(chainId, 'PriceValidationEngine')

  const { data, isLoading, error, refetch } = useContracts(
    [
      engine && { ...engine, functionName: 'peekPrice', args: [feedId] },
      engine && { ...engine, functionName: 'getFeed', args: [feedId] },
      engine && { ...engine, functionName: 'getSources', args: [feedId] },
      engine && { ...engine, functionName: 'validationCount', args: [feedId] },
      engine && { ...engine, functionName: 'isTradable', args: [feedId] },
    ],
    { refetchInterval: 10_000 }
  )

  const ok = (i) => data?.[i]?.status === 'success'
  const peek = ok(0) ? data[0].result : null
  const feed = ok(1) ? data[1].result : null

  // getFeed reverts with UnknownFeed when the feed was never created.
  const exists = ok(1)

  return {
    isLoading,
    error,
    refetch,
    exists,
    feed: exists
      ? {
          price: peek?.[0] ?? null,
          validatedAt: peek?.[1] ?? null,
          sourceCount: peek?.[2] ?? null,
          paused: peek?.[3] ?? null,
          fresh: peek?.[4] ?? null,
          description: feed?.[0] ?? '',
          risk: feed?.[1] ?? null,
          validationCount: ok(3) ? data[3].result : null,
          tradable: ok(4) ? data[4].result : null,
        }
      : null,
    sources: ok(2) ? data[2].result : [],
  }
}

/** The latest quote each registered source published for a feed. */
export function useFeedQuotes(feedId, sources) {
  const chainId = useChainId()
  const engine = contractFor(chainId, 'PriceValidationEngine')

  const { data, isLoading } = useContracts(
    (sources ?? []).map(
      (s) => engine && { ...engine, functionName: 'getQuote', args: [feedId, s.reporter] }
    ),
    { refetchInterval: 10_000 }
  )

  return {
    isLoading,
    quotes: (sources ?? []).map((s, i) => ({
      source: s,
      quote: data?.[i]?.status === 'success' ? data[i].result : null,
    })),
  }
}

/** A registered real-world asset and its custody attestation. */
export function useAsset(assetId) {
  const chainId = useChainId()
  const assets = contractFor(chainId, 'RWAAssetRegistry')
  const token = contractFor(chainId, 'RWAToken')

  const { data, isLoading, error, refetch } = useContracts([
    assets && { ...assets, functionName: 'getAsset', args: [assetId] },
    assets && { ...assets, functionName: 'getCustody', args: [assetId] },
    assets && { ...assets, functionName: 'isMintable', args: [assetId] },
    assets && { ...assets, functionName: 'attestedUnits', args: [assetId] },
    token && { ...token, functionName: 'totalSupply' },
    token && { ...token, functionName: 'backingRatioBps' },
    token && { ...token, functionName: 'symbol' },
  ])

  const ok = (i) => data?.[i]?.status === 'success'

  return {
    isLoading,
    error,
    refetch,
    exists: ok(0),
    asset: ok(0) ? data[0].result : null,
    custody: ok(1) ? data[1].result : null,
    mintable: ok(2) ? data[2].result : null,
    attestedUnits: ok(3) ? data[3].result : null,
    supply: ok(4) ? data[4].result : null,
    backingBps: ok(5) ? data[5].result : null,
    tokenSymbol: ok(6) ? data[6].result : null,
  }
}

/** A market plus its live seasoning progress. */
export function useMarket(marketId) {
  const chainId = useChainId()
  const factory = contractFor(chainId, 'MarketFactory')

  const { data, isLoading, error, refetch } = useContracts(
    [
      factory && { ...factory, functionName: 'getMarket', args: [marketId] },
      factory && { ...factory, functionName: 'activationProgress', args: [marketId] },
      factory && { ...factory, functionName: 'bounds' },
    ],
    { refetchInterval: 10_000 }
  )

  const ok = (i) => data?.[i]?.status === 'success'
  const p = ok(1) ? data[1].result : null

  return {
    isLoading,
    error,
    refetch,
    exists: ok(0),
    market: ok(0) ? data[0].result : null,
    bounds: ok(2) ? data[2].result : null,
    progress: p
      ? {
          elapsed: p[0],
          seasoningRequired: p[1],
          validationsObserved: p[2],
          validationsRequired: p[3],
          ready: p[4],
        }
      : null,
  }
}

/** Enumerate every market the factory has ever seen. */
export function useAllMarkets() {
  const chainId = useChainId()
  const factory = contractFor(chainId, 'MarketFactory')

  const { data: countData } = useContracts([factory && { ...factory, functionName: 'marketCount' }])
  const count = countData?.[0]?.status === 'success' ? Number(countData[0].result) : 0

  const { data: idData } = useContracts(
    Array.from({ length: count }, (_, i) => factory && { ...factory, functionName: 'marketIdAt', args: [BigInt(i)] })
  )
  const ids = (idData ?? []).filter((d) => d?.status === 'success').map((d) => d.result)

  const { data: marketData, isLoading } = useContracts(
    ids.map((mid) => factory && { ...factory, functionName: 'getMarket', args: [mid] })
  )

  return {
    isLoading,
    markets: ids.map((mid, i) => ({
      marketId: mid,
      market: marketData?.[i]?.status === 'success' ? marketData[i].result : null,
    })).filter((m) => m.market),
  }
}

/** Every price feed with its health, risk envelope and sources. */
export function useAllFeeds() {
  const chainId = useChainId()
  const engine = contractFor(chainId, 'PriceValidationEngine')

  const { data: countData } = useContracts([engine && { ...engine, functionName: 'feedCount' }])
  const count = countData?.[0]?.status === 'success' ? Number(countData[0].result) : 0

  const { data: idData } = useContracts(
    Array.from({ length: count }, (_, i) => engine && { ...engine, functionName: 'feedIdAt', args: [BigInt(i)] })
  )
  const ids = (idData ?? []).filter((d) => d?.status === 'success').map((d) => d.result)

  // Three reads per feed, flattened into one multicall.
  const { data, isLoading } = useContracts(
    ids.flatMap((fid) =>
      engine
        ? [
            { ...engine, functionName: 'getFeed', args: [fid] },
            { ...engine, functionName: 'peekPrice', args: [fid] },
            { ...engine, functionName: 'getSources', args: [fid] },
          ]
        : []
    ),
    { refetchInterval: 10_000 }
  )

  const feeds = ids
    .map((fid, i) => {
      const g = data?.[i * 3]
      const p = data?.[i * 3 + 1]
      const s = data?.[i * 3 + 2]
      if (g?.status !== 'success') return null

      const peek = p?.status === 'success' ? p.result : []
      const risk = g.result[1]
      const validatedAt = peek[1] ?? 0n
      const fresh =
        validatedAt !== 0n &&
        BigInt(Math.floor(Date.now() / 1000)) - validatedAt <= BigInt(risk?.maxStaleness ?? 0)

      return {
        feedId: fid,
        description: g.result[0],
        risk,
        price: peek[0] ?? null,
        validatedAt,
        sourceCount: peek[2] ?? 0,
        paused: peek[3] ?? false,
        tradable: Boolean(!peek[3] && fresh),
        sources: s?.status === 'success' ? s.result : [],
      }
    })
    .filter(Boolean)

  return { isLoading, feeds }
}

/** The factory's global proposal bounds. */
export function useMarketBounds() {
  const chainId = useChainId()
  const factory = contractFor(chainId, 'MarketFactory')

  const { data, isLoading } = useContracts([factory && { ...factory, functionName: 'bounds' }], {
    refetchInterval: 60_000,
  })

  const b = data?.[0]?.status === 'success' ? data[0].result : null

  return {
    isLoading,
    bounds: b
      ? {
          maxLeverageCap: b[0],
          minInitialMarginBps: b[1],
          minMaintenanceMarginBps: b[2],
          seasoningPeriod: b[3],
          requiredValidations: b[4],
          proposalTTL: b[5],
          bondAmount: b[6],
        }
      : null,
  }
}

/** Enumerate registered assets. */
export function useAllAssets() {
  const chainId = useChainId()
  const registry = contractFor(chainId, 'RWAAssetRegistry')

  const { data: countData } = useContracts([registry && { ...registry, functionName: 'assetCount' }])
  const count = countData?.[0]?.status === 'success' ? Number(countData[0].result) : 0

  const { data: idData } = useContracts(
    Array.from({ length: count }, (_, i) => registry && { ...registry, functionName: 'assetIdAt', args: [BigInt(i)] })
  )
  const ids = (idData ?? []).filter((d) => d?.status === 'success').map((d) => d.result)

  const { data: assetData, isLoading } = useContracts(
    ids.map((aid) => registry && { ...registry, functionName: 'getAsset', args: [aid] })
  )

  return {
    isLoading,
    assets: ids.map((aid, i) => ({
      assetId: aid,
      asset: assetData?.[i]?.status === 'success' ? assetData[i].result : null,
    })).filter((a) => a.asset),
  }
}

/** The connected wallet's compliance standing and token balance. */
export function useAccountStatus(address) {
  const chainId = useChainId()
  const compliance = contractFor(chainId, 'ComplianceRegistry')
  const token = contractFor(chainId, 'RWAToken')

  const { data, isLoading, refetch } = useContracts([
    compliance && address && { ...compliance, functionName: 'isVerified', args: [address] },
    compliance && address && { ...compliance, functionName: 'tierOf', args: [address] },
    compliance && address && { ...compliance, functionName: 'attestationOf', args: [address] },
    token && address && { ...token, functionName: 'balanceOf', args: [address] },
  ])

  const ok = (i) => data?.[i]?.status === 'success'

  return {
    isLoading,
    refetch,
    verified: ok(0) ? data[0].result : false,
    tier: ok(1) ? Number(data[1].result) : 0,
    attestation: ok(2) ? data[2].result : null,
    balance: ok(3) ? data[3].result : null,
  }
}
