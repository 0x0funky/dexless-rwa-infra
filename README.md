# DEXless — Permissionless RWA Market Creation Layer

> We don't rely on prices. We validate markets.

Real-world assets fail to trade on-chain not because tokenising them is hard, but
because **pricing them is**. Gold, fund units and receivables have no 24/7 order
book, so venues fall back on a single oracle (one point of failure), a single CEX
reference (dies at market close), or a human listing committee (weeks of latency).

DEXless takes the opposite position: assume no source is trustworthy, and admit a
price only when several independent classes of source agree, on-chain, under
rules anyone can audit. A market then has to *earn* its listing by proving its
feed stays healthy — no committee approves it.

Deployed on **BNB Chain**.

---

## Contracts

| Contract | Role |
| --- | --- |
| [`PriceValidationEngine`](contracts/core/PriceValidationEngine.sol) | Multi-source price ingestion with five on-chain validation checks |
| [`MarketFactory`](contracts/core/MarketFactory.sol) | Permissionless market proposal, seasoning and activation |
| [`RWAAssetRegistry`](contracts/registry/RWAAssetRegistry.sol) | Asset registration + custodian proof-of-reserve |
| [`ComplianceRegistry`](contracts/registry/ComplianceRegistry.sol) | KYC attestations, tiers, jurisdiction blocking |
| [`RWAToken`](contracts/token/RWAToken.sol) | 1:1 backed, transfer-restricted ERC-20 |
| [`FeeDistributor`](contracts/token/FeeDistributor.sol) | Merkle-proven yield and fee distribution |

### The validation engine

Every price update runs five checks before it is admitted:

1. **Freshness** — quote age ≤ `maxStaleness`
2. **Spread** — `(ask − bid) / mid` ≤ `maxSpreadBps`
3. **Depth** — quotable notional ≥ `minDepth`
4. **Deviation** — `|price − median| / median` ≤ `maxDeviationBps`
5. **Cross-source consistency** — enough survivors, spanning enough source *kinds*
   (`MM_QUOTE` / `CEX` / `DEX` / `ORACLE` / `NAV`)

The accepted price is the **median** of survivors — immune to a single outlier.
Rejections are emitted as events, so a source being dropped is publicly visible
rather than silently swallowed. After `failuresToPause` consecutive failures the
feed pauses itself and stops serving prices downstream.

### Earning a listing

`proposeMarket()` is open to anyone. It does not create a tradable market — it
starts a clock. The proposal activates only once its feed has passed
`requiredValidations` clean rounds across `seasoningPeriod` seconds, and the
activation call is itself permissionless. The bond is refunded either way; it
exists to price spam, not to punish.

### 1:1 backing, enforced

`RWAToken.mint()` reverts if supply would exceed the custodian's most recent
attested reserve, and the custodian's attestation expires after 35 days. Backing
is a contract invariant, not a promise in a PDF.

---

## Quick start

```bash
npm install
npm run build
npm test                       # 74 tests

cp .env.example .env           # fill in keys
npm run deploy:testnet
npm run verify:testnet
npm run flow:testnet           # runs the full business flow, writes docs/onchain-flow.md
npm run keeper                 # starts the pricing pipeline

npm run abi                    # publish ABIs + addresses to the app
npm --prefix app install
npm run app                    # dApp on http://localhost:5173
```

Mainnet uses the same commands with `:mainnet`. Re-run `npm run abi` after every
deploy — it regenerates `app/src/lib/generated.js` from the Hardhat artifacts and
`deployments/`, so the frontend can never drift from the deployed contracts.

## Layout

```
contracts/     core/ registry/ token/ interfaces/ mocks/
test/          74 tests across all six contracts
scripts/       config.ts · deploy.ts · verify.ts · business-flow.ts · export-abi.ts
keeper/        off-chain pricing pipeline + source adapters
app/           React 19 + Vite + Tailwind 4 dApp (wagmi/viem)
docs/          RWA-INFRA.md · RWA-ASSET.md · SUBMISSION.md · onchain-flow.md
deployments/   address books per network (committed on purpose)
```

### The dApp

The app reads chain state only — there is no mock data anywhere in the build.
The Dashboard shows the live feed price with a per-source breakdown (and the
on-chain verdict for each source), the protocol counters, and the **seasoning
progress** of every proposed market. When no contracts are deployed on the
connected chain, it says so rather than inventing numbers.

Pages still to port live in `app/src/pages/_legacy/` — good mock designs that
must be rewired to real contract reads before launch. `app/src/pages/NotWired.jsx`
lists what each one needs.

`scripts/config.ts` is the single source of truth for the pilot asset, feed,
risk envelope and market bounds. Edit it, not the scripts.

## Security posture

- Solidity 0.8.24, `evmVersion: shanghai` (portable across BSC forks — do not
  change without re-verifying)
- OpenZeppelin v5 for access control, ERC-20, reentrancy, Merkle proofs
- Custom errors throughout; no `require` strings
- **Not yet externally audited.** Before this holds material value: move
  `DEFAULT_ADMIN_ROLE` to a multisig and commission an audit.

## License

MIT
