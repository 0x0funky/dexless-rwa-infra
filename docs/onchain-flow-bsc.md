# DEXless — On-Chain Business Flow Record

Network: **bsc** (chainId 56)
Explorer: https://bscscan.com

Every transaction below is a real business event in the RWA lifecycle:
asset registration → reserve attestation → price validation → investor
onboarding → 1:1 issuance → market creation → trading → redemption.

## Contracts

| Contract | Address |
| --- | --- |
| ComplianceRegistry | [`0x23488Dd95646473c091c04D0647D7445020778DE`](https://bscscan.com/address/0x23488Dd95646473c091c04D0647D7445020778DE#code) |
| RWAAssetRegistry | [`0x59511F70Ab6EAD4b9c0518B0DA2Cf539e58533A4`](https://bscscan.com/address/0x59511F70Ab6EAD4b9c0518B0DA2Cf539e58533A4#code) |
| PriceValidationEngine | [`0xcB37EFDC925200bEF595c9D8EbC7Ee7F69A1C6c0`](https://bscscan.com/address/0xcB37EFDC925200bEF595c9D8EbC7Ee7F69A1C6c0#code) |
| MarketFactory | [`0xfC3bE79eEBeE5BC903218FA9AE6d18C64519D392`](https://bscscan.com/address/0xfC3bE79eEBeE5BC903218FA9AE6d18C64519D392#code) |
| RWAToken | [`0x828c65a57473Ec4bad3303F63a6321Fa33a14c85`](https://bscscan.com/address/0x828c65a57473Ec4bad3303F63a6321Fa33a14c85#code) |
| FeeDistributor | [`0x0B01465b1288B91C0eDAa5DAF799eDEe3f43dd05`](https://bscscan.com/address/0x0B01465b1288B91C0eDAa5DAF799eDEe3f43dd05#code) |

## Transactions

| # | Step | Contract | Method | Block | Tx |
| --- | --- | --- | --- | --- | --- |
| 1 | Asset registered | RWAAssetRegistry | `registerAsset` | 119141555 | [`0xda097ffb5a…`](https://bscscan.com/tx/0xda097ffb5ae747765ef1f2d95318ade893397d51fb64675ff215e4a82e0eedac) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 119141559 | [`0x085198f0bf…`](https://bscscan.com/tx/0x085198f0bfeda47583575ee6d041677669ea00269c4469e44aa79d13a52eca7e) |
| 3 | Price feed created | PriceValidationEngine | `createFeed` | 119141562 | [`0x518e19f30c…`](https://bscscan.com/tx/0x518e19f30c3870a8e9e18fbc662d777ec32c8b8107cc9559f8e8c8c0a2265b18) |
| 3 | Source registered: Binance PAXG | PriceValidationEngine | `addSource` | 119141565 | [`0x7b7c34ab52…`](https://bscscan.com/tx/0x7b7c34ab52a792bc15ab7a95adfa84d3ee906b0b19ace78a213de1a3212d0f3f) |
| 3 | Source registered: OKX PAXG | PriceValidationEngine | `addSource` | 119141569 | [`0x33e47417f9…`](https://bscscan.com/tx/0x33e47417f9ecd653af99ef08dbe0c2f07b0bb0322c34dc6f1d2d30aeff9faf6c) |
| 3 | Source registered: Pyth XAU/USD | PriceValidationEngine | `addSource` | 119141571 | [`0xc42772ab71…`](https://bscscan.com/tx/0xc42772ab71daecdc49fed922c009d4b2760b57cbb1a81e66e722beb1bf25e514) |
| 3 | Source registered: Gate.io PAXG | PriceValidationEngine | `addSource` | 119141573 | [`0x9356d52564…`](https://bscscan.com/tx/0x9356d52564aae90588ddca523aa9f76f233067dd4979aa46b48fc8143269e703) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 119141576 | [`0x856284e145…`](https://bscscan.com/tx/0x856284e1450cac6964856b0ad519643b3a5d616d66d9fb38a26d97358ee028cc) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 119141579 | [`0xabcb737a78…`](https://bscscan.com/tx/0xabcb737a78273b911981601570eded490fd0a87cbb6f056955ddb3020bb3b4ce) |
| 4 | Quote published: Gate.io PAXG | PriceValidationEngine | `submitQuote` | 119141583 | [`0x95a5ab80b9…`](https://bscscan.com/tx/0x95a5ab80b949333c1543a836be044a35ebf232ae0c37a080b17388d839c7f69b) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 119141586 | [`0x633f870759…`](https://bscscan.com/tx/0x633f870759809de82578f537ce5b3853d46c0d4ca6c45a0d82c327c2fce7ce12) |
| 5 | Investor verified: 0xB6588b3d… | ComplianceRegistry | `attest` | 119141589 | [`0x2ea8bfec0c…`](https://bscscan.com/tx/0x2ea8bfec0c80dc3664922034fc24e62d54e5eaf2aeb9c494fa122fa72765f2ae) |
| 5 | Investor verified: 0x660f5994… | ComplianceRegistry | `attest` | 119141592 | [`0xa24104b354…`](https://bscscan.com/tx/0xa24104b354faf3175088d80feaff419de91870a6b1d4660c6242959308a10c9d) |
| 5 | Investor verified: 0xb02208F3… | ComplianceRegistry | `attest` | 119141595 | [`0x1f87ed15e9…`](https://bscscan.com/tx/0x1f87ed15e9412806f3c3188f924292758a39fa4cb553960db0cea151a3257a83) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 119141599 | [`0xa57d34e11e…`](https://bscscan.com/tx/0xa57d34e11ea4453a28d9194ce98ad3d84b475de5ef7fc5e812234ec7cd24f439) |
| 9 | Holder transfer | RWAToken | `transfer` | 119141603 | [`0xc102852ebd…`](https://bscscan.com/tx/0xc102852ebd55d3fb8717f8c80f0acf6263b63d598773cffcf140952708adcfaa) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 119142005 | [`0x4ef0eee16a…`](https://bscscan.com/tx/0x4ef0eee16a002d1fcddee49036ebaeb92739fce0894c4a1ca78b718d8a28fe30) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 119142009 | [`0x159d22fb88…`](https://bscscan.com/tx/0x159d22fb88451663bd10f02d7e537e3bfb1b95a4b63ab6c24787ba7f7e4c5158) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 119142012 | [`0xd18e135406…`](https://bscscan.com/tx/0xd18e13540698d7bbb9d73742688070d29a2f9d2e00d84d8ff72203b2e8dc90b3) |
| 4 | Quote published: Gate.io PAXG | PriceValidationEngine | `submitQuote` | 119142017 | [`0xffc66e9c1f…`](https://bscscan.com/tx/0xffc66e9c1f4786e5c90e37d558c0125d2b8b41851d8f94a2d1c569daabe95bbf) |
| 4 | Quote published: Chainlink XAU/USD | PriceValidationEngine | `submitQuote` | 119142020 | [`0xa3a1940f14…`](https://bscscan.com/tx/0xa3a1940f14720504dde75862f6b8ae3f200533d9767d6c526933edfdc9cb0594) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 119142022 | [`0x6afb2d42a3…`](https://bscscan.com/tx/0x6afb2d42a38da428a1a3a0f8a88611a4e82e1bb915eca9287cf1379b0471f668) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 119142025 | [`0x679c538374…`](https://bscscan.com/tx/0x679c538374aa02ec103c437474b562f77c13343f0aaaa8c443de36285d5f952a) |
| 7 | Market proposed | MarketFactory | `proposeMarket` | 119142028 | [`0xf384494abb…`](https://bscscan.com/tx/0xf384494abb19b4c1f7ffe16f578f2a0eba784a32147b7e810a34fb2d4ec3efea) |
| 9 | Holder transfer | RWAToken | `transfer` | 119142031 | [`0xfaedfb5e45…`](https://bscscan.com/tx/0xfaedfb5e452c5c222ab90ff270190335ea7f6d0dfd30f23c160aaa1dd696739e) |
