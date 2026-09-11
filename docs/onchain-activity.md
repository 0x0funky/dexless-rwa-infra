# DEXless — On-Chain Activity

Network **bscTestnet** (chainId 97)
Contracts deployed at block 124323132 · report generated 2026-08-31T09:51:37.272Z

> **Note on event counts.** This scan covered blocks 128244029–128274029 at 0% chunk
> coverage and does not reach back to deployment. Event totals below are therefore a **lower bound**.
> Transaction counts and protocol counters above are exact — they come from wallet
> nonces and direct contract reads, not from log queries.

## Protocol state

| Metric | Value |
| --- | --- |
| Validation rounds | 14 |
| Quotes submitted | 53 |
| Price feeds | 2 |
| Assets registered | 2 |
| Markets | 2 (2 active) |
| Attested addresses | 3 |
| RWA token supply | 60.0 |
| **Transactions from project wallets** | **138** |

## Contracts

| Contract | Address |
| --- | --- |
| PriceValidationEngine | [`0xB69157314342e0eb5De62788F61E278c43e588B1`](https://testnet.bscscan.com/address/0xB69157314342e0eb5De62788F61E278c43e588B1) |
| MarketFactory | [`0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7`](https://testnet.bscscan.com/address/0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7) |
| RWAAssetRegistry | [`0x515740C4293005292ABb7aEb920b08942E743eA0`](https://testnet.bscscan.com/address/0x515740C4293005292ABb7aEb920b08942E743eA0) |
| ComplianceRegistry | [`0x7ba9dd9791bc64a782A874FA2A9d548791c098B5`](https://testnet.bscscan.com/address/0x7ba9dd9791bc64a782A874FA2A9d548791c098B5) |
| RWAToken | [`0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1`](https://testnet.bscscan.com/address/0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1) |
| FeeDistributor | [`0xd804544EdDc01562e110a971095d002906d60460`](https://testnet.bscscan.com/address/0xd804544EdDc01562e110a971095d002906d60460) |

## Project-operated wallets

Infrastructure wallets run the pricing pipeline — every protocol operates its own
data nodes, and these publish real market data from Binance, OKX, Gate.io and Pyth.
Wallets marked *project-operated* were used to exercise flows during testing and are
**not** independent users.

| Transactions | Role | Address | Nature |
| --- | --- | --- | --- |
| 74 | Operator / deployer | [`0x6cCB3D1a6019C3fE0C3a8fd50142a2d3Bccb0030`](https://testnet.bscscan.com/address/0x6cCB3D1a6019C3fE0C3a8fd50142a2d3Bccb0030) | infrastructure |
| 12 | Retired source slot | [`0xF8981b70221b9C7d2A4C83a8e2a2afa3DA035f06`](https://testnet.bscscan.com/address/0xF8981b70221b9C7d2A4C83a8e2a2afa3DA035f06) | infrastructure |
| 19 | Price source — Binance | [`0xdC4A74De99Fe54ee4Def294993c128233B9eB38a`](https://testnet.bscscan.com/address/0xdC4A74De99Fe54ee4Def294993c128233B9eB38a) | infrastructure |
| 15 | Price source — OKX | [`0xa2Dc2c8B860B490D6Bf9fa7E37417a9D260f61B1`](https://testnet.bscscan.com/address/0xa2Dc2c8B860B490D6Bf9fa7E37417a9D260f61B1) | infrastructure |
| 7 | Price source — Pyth | [`0x9b85e41bd44682347F06EEAC91a5ebB3baf8d6e5`](https://testnet.bscscan.com/address/0x9b85e41bd44682347F06EEAC91a5ebB3baf8d6e5) | infrastructure |
| 3 | Price source — Gate.io | [`0x2110718f7f942ab54487ECAc4a0AA70acd33c3eB`](https://testnet.bscscan.com/address/0x2110718f7f942ab54487ECAc4a0AA70acd33c3eB) | infrastructure |
| 7 | Test participant 1 | [`0xa0a4735A6BF8b81f80140821d166DA9F14925294`](https://testnet.bscscan.com/address/0xa0a4735A6BF8b81f80140821d166DA9F14925294) | project-operated |
| 1 | Test participant 2 | [`0x148Dd821AEC1900dc9a33a7E5D6B2657d48036Da`](https://testnet.bscscan.com/address/0x148Dd821AEC1900dc9a33a7E5D6B2657d48036Da) | project-operated |
| 0 | Test participant 3 | [`0x3536bd85522a92aDEAB7cb84cFC5c78D70ED4F32`](https://testnet.bscscan.com/address/0x3536bd85522a92aDEAB7cb84cFC5c78D70ED4F32) | project-operated |

## Events observed

| Count | Contract | Event |
| --- | --- | --- |
| — | — | *(no events in the scanned window)* |

## Recent activity

| Block | Contract | Event | Tx |
| --- | --- | --- | --- |
| — | — | — | *(none in the scanned window)* |
