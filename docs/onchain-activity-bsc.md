# DEXless — On-Chain Activity

Network **bsc** (chainId 56)
Contracts deployed at block 119141067 · report generated 2026-08-31T18:33:39.391Z

> **Note on event counts.** This scan covered blocks 119149859–119199859 at 0% chunk
> coverage and does not reach back to deployment. Event totals below are therefore a **lower bound**.
> Transaction counts and protocol counters above are exact — they come from wallet
> nonces and direct contract reads, not from log queries.

## Protocol state

| Metric | Value |
| --- | --- |
| Validation rounds | 2 |
| Quotes submitted | 11 |
| Price feeds | 1 |
| Assets registered | 1 |
| Markets | 1 (0 active) |
| Attested addresses | 3 |
| RWA token supply | 20.0 |
| **Transactions from project wallets** | **49** |

## Contracts

| Contract | Address |
| --- | --- |
| PriceValidationEngine | [`0xcB37EFDC925200bEF595c9D8EbC7Ee7F69A1C6c0`](https://bscscan.com/address/0xcB37EFDC925200bEF595c9D8EbC7Ee7F69A1C6c0) |
| MarketFactory | [`0xfC3bE79eEBeE5BC903218FA9AE6d18C64519D392`](https://bscscan.com/address/0xfC3bE79eEBeE5BC903218FA9AE6d18C64519D392) |
| RWAAssetRegistry | [`0x59511F70Ab6EAD4b9c0518B0DA2Cf539e58533A4`](https://bscscan.com/address/0x59511F70Ab6EAD4b9c0518B0DA2Cf539e58533A4) |
| ComplianceRegistry | [`0x23488Dd95646473c091c04D0647D7445020778DE`](https://bscscan.com/address/0x23488Dd95646473c091c04D0647D7445020778DE) |
| RWAToken | [`0x828c65a57473Ec4bad3303F63a6321Fa33a14c85`](https://bscscan.com/address/0x828c65a57473Ec4bad3303F63a6321Fa33a14c85) |
| FeeDistributor | [`0x0B01465b1288B91C0eDAa5DAF799eDEe3f43dd05`](https://bscscan.com/address/0x0B01465b1288B91C0eDAa5DAF799eDEe3f43dd05) |

## Project-operated wallets

Infrastructure wallets run the pricing pipeline — every protocol operates its own
data nodes, and these publish real market data from Binance, OKX, Gate.io and Pyth.
Wallets marked *project-operated* were used to exercise flows during testing and are
**not** independent users.

| Transactions | Role | Address | Nature |
| --- | --- | --- | --- |
| 35 | Operator / deployer | [`0x620CDFeca08DECA8BEb144460CA9270DB8ad4608`](https://bscscan.com/address/0x620CDFeca08DECA8BEb144460CA9270DB8ad4608) | infrastructure |
| 4 | Price source — Binance PAXG | [`0x10638d0Bf012B8bE9350969dD8c68564b2671dFf`](https://bscscan.com/address/0x10638d0Bf012B8bE9350969dD8c68564b2671dFf) | infrastructure |
| 3 | Price source — OKX PAXG | [`0x190a9e1F107aBDA8F2E8e87aeA456E35Bb2CFC01`](https://bscscan.com/address/0x190a9e1F107aBDA8F2E8e87aeA456E35Bb2CFC01) | infrastructure |
| 0 | Price source — Pyth XAU/USD | [`0x02D285FB1D504363d662fA5127E63eAA69e49592`](https://bscscan.com/address/0x02D285FB1D504363d662fA5127E63eAA69e49592) | infrastructure |
| 3 | Price source — Gate.io PAXG | [`0xe7Aa807563182c5787936d639C66a7C4E442556E`](https://bscscan.com/address/0xe7Aa807563182c5787936d639C66a7C4E442556E) | infrastructure |
| 2 | Price source — Chainlink XAU/USD | [`0x5eB43bBdDe34e0334622D5DC023a62129aa1C2e4`](https://bscscan.com/address/0x5eB43bBdDe34e0334622D5DC023a62129aa1C2e4) | infrastructure |
| 2 | Test participant 1 | [`0xB6588b3dc5232da44257b6406572aB69395B2C25`](https://bscscan.com/address/0xB6588b3dc5232da44257b6406572aB69395B2C25) | project-operated |
| 0 | Test participant 2 | [`0x660f59942f07A3C5bA432d7f9F72B5eA78067fA6`](https://bscscan.com/address/0x660f59942f07A3C5bA432d7f9F72B5eA78067fA6) | project-operated |
| 0 | Test participant 3 | [`0xb02208F350B2FacA9160ADa122e0799Fe8765f6E`](https://bscscan.com/address/0xb02208F350B2FacA9160ADa122e0799Fe8765f6E) | project-operated |

## Events observed

| Count | Contract | Event |
| --- | --- | --- |
| — | — | *(no events in the scanned window)* |

## Recent activity

| Block | Contract | Event | Tx |
| --- | --- | --- | --- |
| — | — | — | *(none in the scanned window)* |
