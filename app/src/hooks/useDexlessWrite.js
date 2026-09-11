import { useCallback, useState } from 'react'
import { useAccount, useChainId, useWriteContract, usePublicClient } from 'wagmi'
import { contractFor, txUrl } from '../lib/contracts'

/**
 * Write-side hooks.
 *
 * Every one of these sends a real transaction. They surface three things the UI
 * needs and that wagmi does not bundle together: the simulation error *before*
 * the wallet opens (so a user is never asked to sign a call that must revert),
 * the pending hash, and the mined receipt.
 */

/** Decode a viem revert into the contract's own error name where possible. */
function readableError(err) {
  const raw = err?.shortMessage || err?.details || err?.message || String(err)

  // User rejections are not failures worth shouting about.
  if (/User rejected|denied transaction|User denied/i.test(raw)) return null

  const custom = err?.cause?.data?.errorName || err?.data?.errorName
  if (custom) {
    const args = err?.cause?.data?.args ?? err?.data?.args
    return args?.length ? `${custom}(${args.join(', ')})` : custom
  }

  // viem puts the custom error name in the message for unsimulated reverts.
  const m = raw.match(/reverted with the following reason:\s*(\w+)/)
  if (m) return m[1]

  return raw.split('\n')[0]
}

/**
 * Wraps one contract write with simulate → send → wait, exposing a single
 * status the UI can drive off.
 */
export function useContractAction(contractName, functionName) {
  const chainId = useChainId()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [status, setStatus] = useState('idle') // idle | simulating | signing | pending | done | error
  const [hash, setHash] = useState(null)
  const [error, setError] = useState(null)
  const [receipt, setReceipt] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setHash(null)
    setError(null)
    setReceipt(null)
  }, [])

  const execute = useCallback(
    async ({ args = [], value } = {}) => {
      const target = contractFor(chainId, contractName)
      if (!target) {
        setError(`${contractName} is not deployed on chain ${chainId}`)
        setStatus('error')
        return null
      }
      if (!address) {
        setError('Connect a wallet first')
        setStatus('error')
        return null
      }

      setError(null)
      setReceipt(null)
      setHash(null)

      // Simulate first: a revert caught here never reaches the user's wallet.
      setStatus('simulating')
      try {
        await publicClient.simulateContract({
          address: target.address,
          abi: target.abi,
          functionName,
          args,
          value,
          account: address,
        })
      } catch (e) {
        setError(readableError(e) ?? 'Simulation failed')
        setStatus('error')
        return null
      }

      setStatus('signing')
      let txHash
      try {
        txHash = await writeContractAsync({
          address: target.address,
          abi: target.abi,
          functionName,
          args,
          value,
        })
      } catch (e) {
        const msg = readableError(e)
        setStatus(msg ? 'error' : 'idle') // silent reset when the user cancelled
        if (msg) setError(msg)
        return null
      }

      setHash(txHash)
      setStatus('pending')

      try {
        const rc = await publicClient.waitForTransactionReceipt({ hash: txHash })
        setReceipt(rc)
        if (rc.status === 'success') {
          setStatus('done')
          return rc
        }
        setError('Transaction reverted on-chain')
        setStatus('error')
        return null
      } catch (e) {
        setError(readableError(e) ?? 'Could not confirm the transaction')
        setStatus('error')
        return null
      }
    },
    [address, chainId, contractName, functionName, publicClient, writeContractAsync]
  )

  return {
    execute,
    reset,
    status,
    hash,
    error,
    receipt,
    explorerUrl: hash ? txUrl(chainId, hash) : null,
    isBusy: status === 'simulating' || status === 'signing' || status === 'pending',
  }
}

export const useProposeMarket = () => useContractAction('MarketFactory', 'proposeMarket')
export const useActivateMarket = () => useContractAction('MarketFactory', 'activateMarket')
export const useRejectStaleProposal = () => useContractAction('MarketFactory', 'rejectStaleProposal')
export const usePauseUnhealthyMarket = () => useContractAction('MarketFactory', 'pauseUnhealthyMarket')
export const useValidateFeed = () => useContractAction('PriceValidationEngine', 'validate')
export const useRequestRedemption = () => useContractAction('RWAToken', 'requestRedemption')
