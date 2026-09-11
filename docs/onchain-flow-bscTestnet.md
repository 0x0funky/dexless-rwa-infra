# DEXless — On-Chain Business Flow Record

Network: **bscTestnet** (chainId 97)
Explorer: https://testnet.bscscan.com

Every transaction below is a real business event in the RWA lifecycle:
asset registration → reserve attestation → price validation → investor
onboarding → 1:1 issuance → market creation → trading → redemption.

## Contracts

| Contract | Address |
| --- | --- |
| ComplianceRegistry | [`0x7ba9dd9791bc64a782A874FA2A9d548791c098B5`](https://testnet.bscscan.com/address/0x7ba9dd9791bc64a782A874FA2A9d548791c098B5#code) |
| RWAAssetRegistry | [`0x515740C4293005292ABb7aEb920b08942E743eA0`](https://testnet.bscscan.com/address/0x515740C4293005292ABb7aEb920b08942E743eA0#code) |
| PriceValidationEngine | [`0xB69157314342e0eb5De62788F61E278c43e588B1`](https://testnet.bscscan.com/address/0xB69157314342e0eb5De62788F61E278c43e588B1#code) |
| MarketFactory | [`0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7`](https://testnet.bscscan.com/address/0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7#code) |
| RWAToken | [`0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1`](https://testnet.bscscan.com/address/0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1#code) |
| FeeDistributor | [`0xd804544EdDc01562e110a971095d002906d60460`](https://testnet.bscscan.com/address/0xd804544EdDc01562e110a971095d002906d60460#code) |

## Transactions

| # | Step | Contract | Method | Block | Tx |
| --- | --- | --- | --- | --- | --- |
| 1 | Asset registered | RWAAssetRegistry | `registerAsset` | 124323192 | [`0x1e3394510c…`](https://testnet.bscscan.com/tx/0x1e3394510c04bf9739203e5a886cab99bdf51df53ee73f885de5b7d1f7c2d9ec) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 124323195 | [`0xac19f13fbb…`](https://testnet.bscscan.com/tx/0xac19f13fbba06605ac47fc3dad4fb00a473753fcc2d75c5cbde709517949b74f) |
| 3 | Price feed created | PriceValidationEngine | `createFeed` | 124323197 | [`0x26f0b81476…`](https://testnet.bscscan.com/tx/0x26f0b81476cbc0e53b8416ed90d88a9e2e29a6fb5864a2dacbfa480f271716cf) |
| 3 | Source registered: MM Desk RFQ | PriceValidationEngine | `addSource` | 124323199 | [`0x7ca86522a6…`](https://testnet.bscscan.com/tx/0x7ca86522a66506f4051d582e41c1b7f1a5ed13409c8db19581aa689308224843) |
| 3 | Source registered: Binance PAXG | PriceValidationEngine | `addSource` | 124323202 | [`0xd052cb2715…`](https://testnet.bscscan.com/tx/0xd052cb271517f4494ebcae72f1e987234285ba65a503a40ed3d8d12b7dfed6cf) |
| 3 | Source registered: OKX PAXG | PriceValidationEngine | `addSource` | 124323205 | [`0x5542017694…`](https://testnet.bscscan.com/tx/0x5542017694458023d614db41e6f3027770dde4b5d5b99226f6462f2bfbae5ac5) |
| 4 | Quote published: MM Desk RFQ | PriceValidationEngine | `submitQuote` | 124323208 | [`0xc30692c81f…`](https://testnet.bscscan.com/tx/0xc30692c81f4c53718f7e47dbfc7df4a0d30fd7eca68daef1c809b4e3af3cbbea) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 124323211 | [`0xfd46e41da9…`](https://testnet.bscscan.com/tx/0xfd46e41da9f46376d20fae278c847e4bb39d6ac808091932f479fa0c68e83684) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 124323215 | [`0x5319dd1fd1…`](https://testnet.bscscan.com/tx/0x5319dd1fd132b52c2a162ff70248c58fe124850a87710b0179c576ad414d2fff) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 124323218 | [`0x8717526c2e…`](https://testnet.bscscan.com/tx/0x8717526c2e6dfe6d3f2cf87d5c8fa064327d364ecfb9edcf48d0337c9253c635) |
| 5 | Investor verified: 0xa0a4735A… | ComplianceRegistry | `attest` | 124323221 | [`0xb2735ade30…`](https://testnet.bscscan.com/tx/0xb2735ade303911b38699c64dfb93aa2532a9422446fa3ca196681b0b816b9298) |
| 5 | Investor verified: 0x148Dd821… | ComplianceRegistry | `attest` | 124323224 | [`0xe8750226af…`](https://testnet.bscscan.com/tx/0xe8750226af8815078bf026f1ad8bcbad86fb096108b0ede29f874a6d02647210) |
| 5 | Investor verified: 0x3536bd85… | ComplianceRegistry | `attest` | 124323227 | [`0x0b9bc4e8cb…`](https://testnet.bscscan.com/tx/0x0b9bc4e8cbab517c89e64b6500b64f44291e4d50750d799b95dbf40faec18ee1) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 124323229 | [`0xd50e46a636…`](https://testnet.bscscan.com/tx/0xd50e46a636c56b4a5ca2b1a2c950f42aacf7a4a5080a12d18ba89820f9975365) |
| 7 | Market proposed | MarketFactory | `proposeMarket` | 124323232 | [`0x2fe2a70bf3…`](https://testnet.bscscan.com/tx/0x2fe2a70bf3dafa50a2ef95af555b5a9fffab83cdf18bacabbdafcdf8fb9323dd) |
| 9 | Holder transfer | RWAToken | `transfer` | 124323235 | [`0xa865f794f6…`](https://testnet.bscscan.com/tx/0xa865f794f6cd917e42496847d294f5ea18f286594003424b4f2fce81b3cbc0bc) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 124323663 | [`0x8a8a997eb6…`](https://testnet.bscscan.com/tx/0x8a8a997eb6d86cb2a82ad50cfe65a9350e7559c293841527aff7e95f7240ecb2) |
| 4 | Quote published: MM Desk RFQ | PriceValidationEngine | `submitQuote` | 124323667 | [`0x2ea2485e03…`](https://testnet.bscscan.com/tx/0x2ea2485e03e7e1ecdc0f1134adb662155bd14a450b3f8ca3f75cb94a7ce6d5c1) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 124323670 | [`0x654320449f…`](https://testnet.bscscan.com/tx/0x654320449f75a985dc9c5650661e8b2e5c5223aa00c996f114f89d1ac6cf706a) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 124323673 | [`0xed4dd5157a…`](https://testnet.bscscan.com/tx/0xed4dd5157aa18b8e6e16365c4f76d82a2d5e4006f0b6b004d191951c06257a62) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 124323676 | [`0x0e206fce6c…`](https://testnet.bscscan.com/tx/0x0e206fce6c21d56d2cd954bd168489bb733b75f97cdcbbf41ede34f9fdbef5bb) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 124323678 | [`0x43f3d4f3cd…`](https://testnet.bscscan.com/tx/0x43f3d4f3cdc0bc8e95a0f067e4e2590b8aa438265f547e98132cf9c1abc7245d) |
| 9 | Holder transfer | RWAToken | `transfer` | 124323682 | [`0x213b441d26…`](https://testnet.bscscan.com/tx/0x213b441d267c4f7279c0ac0997491d7066718b3c1cca673e8e44075ea60ffc0a) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 124323696 | [`0xf123186fd5…`](https://testnet.bscscan.com/tx/0xf123186fd57f26f81c706b97f943415d229d23026dfee5153d8209e177719b85) |
| 4 | Quote published: MM Desk RFQ | PriceValidationEngine | `submitQuote` | 124323699 | [`0x516478f527…`](https://testnet.bscscan.com/tx/0x516478f52712afe504bd5017f8c616fddc0a8aabd6670d2393da2383370cdb87) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 124323702 | [`0x7e34e0fe5a…`](https://testnet.bscscan.com/tx/0x7e34e0fe5adcc5341273729ba6ff6aa0ec277369aeb76e97e380e6c9c8ea8667) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 124323704 | [`0x68ad3bb330…`](https://testnet.bscscan.com/tx/0x68ad3bb330e9ded8234f7ff827c53afa2cc3b39892518427545b9bcad45d1c34) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 124323706 | [`0xb5de0b6733…`](https://testnet.bscscan.com/tx/0xb5de0b67331625d41b01280c0c1bc8ca3410ded69ef0fa694a1e5949a4aee948) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 124323709 | [`0xdc70bc4cf3…`](https://testnet.bscscan.com/tx/0xdc70bc4cf304f05d03a735f052059975ad98ca658065a34d0cca1074187f7ecc) |
| 9 | Holder transfer | RWAToken | `transfer` | 124323712 | [`0xe1af039f36…`](https://testnet.bscscan.com/tx/0xe1af039f364f87bc3e835315a83f0b8c23a9ad401b7db772140b41a7203f8481) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 124323721 | [`0xabe28de3a5…`](https://testnet.bscscan.com/tx/0xabe28de3a548282e4c6ba4b2f194871d59b3739cba03ac18f7e0a1b7b63a06b9) |
| 4 | Quote published: MM Desk RFQ | PriceValidationEngine | `submitQuote` | 124323723 | [`0xdcaa867f40…`](https://testnet.bscscan.com/tx/0xdcaa867f402e9563e377de0b00d1480a8309ae3dccab38e7c8d651cba35aa70e) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 124323726 | [`0x09e512d5e7…`](https://testnet.bscscan.com/tx/0x09e512d5e74522e7137474165ff9bba6abbb530518dff66297d107b882c45bb2) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 124323729 | [`0x6e794e62c4…`](https://testnet.bscscan.com/tx/0x6e794e62c492fdeff41b9224623206d0b8db117594ff0cb7be16efc176e01ffc) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 124323731 | [`0x9699b78371…`](https://testnet.bscscan.com/tx/0x9699b78371d217a2079f537149b75179ecd1bb3db60123b57fa6d8c48c3533e1) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 124323734 | [`0x52ffc31301…`](https://testnet.bscscan.com/tx/0x52ffc313016d21e6441dbbe8d19fe61c69277fae6df289ae9b37073af1d0a562) |
| 9 | Holder transfer | RWAToken | `transfer` | 124323739 | [`0x35fc0b406e…`](https://testnet.bscscan.com/tx/0x35fc0b406ea14efa4fbfc948977ded98782c83ab2435342e612dcbb00ba99ecf) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 124323944 | [`0x21f4e10dd1…`](https://testnet.bscscan.com/tx/0x21f4e10dd1d5789e3343d2e543cdd788fcb931e286bcfd3685b46046008a8191) |
| 4 | Quote published: MM Desk RFQ | PriceValidationEngine | `submitQuote` | 124323947 | [`0x9d72e25c62…`](https://testnet.bscscan.com/tx/0x9d72e25c622da926fa7fd59686dd50a3495074ef1af47b0921a81bcc07b3b1ea) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 124323949 | [`0xb61d47a316…`](https://testnet.bscscan.com/tx/0xb61d47a31692aff6d1ab8268e8d4acc96a6142b2af997498a954b3ddbf2ced57) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 124323952 | [`0x441be9edec…`](https://testnet.bscscan.com/tx/0x441be9edec9530510d24747b333056f886fb15e05cb9fbb0b63295ff886de3f2) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 124323955 | [`0xd9b09b4044…`](https://testnet.bscscan.com/tx/0xd9b09b404463171ab145316aaa68fd3a90b4baa46659ca9ac4c69a16f1ded7d0) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 124323960 | [`0xb2c446bbf0…`](https://testnet.bscscan.com/tx/0xb2c446bbf0d91b60419a10646ca06b348c9b87de519955d05278513a291e4589) |
| 8 | Market activated (permissionless) | MarketFactory | `activateMarket` | 124323963 | [`0xf81f381f05…`](https://testnet.bscscan.com/tx/0xf81f381f051c211ff252675ff40c590009e18d5996069235847a461cea336bfd) |
| 9 | Holder transfer | RWAToken | `transfer` | 124323966 | [`0x385e0775be…`](https://testnet.bscscan.com/tx/0x385e0775be5f2228f6ea29f9fe771c4c1b7d25a295d77508ee470e8e2e32ba69) |
| 2 | Custody reserves attested | RWAAssetRegistry | `attestCustody` | 124323986 | [`0xbcf5894f91…`](https://testnet.bscscan.com/tx/0xbcf5894f917a6f65d16689fba2941424b416cffef18bd345df46c978b47a15af) |
| 4 | Quote published: MM Desk RFQ | PriceValidationEngine | `submitQuote` | 124323990 | [`0x676989ecec…`](https://testnet.bscscan.com/tx/0x676989ececb86066d5f39e7d07b0f2a884bd9f7a7418c8f402b0b1a2e7b6cbd5) |
| 4 | Quote published: Binance PAXG | PriceValidationEngine | `submitQuote` | 124323992 | [`0x14d3701200…`](https://testnet.bscscan.com/tx/0x14d370120017e6e99af4bef10fd975648e79b318feb073a26bc0c0d99d16cf6d) |
| 4 | Quote published: OKX PAXG | PriceValidationEngine | `submitQuote` | 124323994 | [`0xfccb8b83f1…`](https://testnet.bscscan.com/tx/0xfccb8b83f1e6fc5f2d2452ff0c2d2e3a721f0e2f7b0c66bee88d8b4eeeffcc7d) |
| 4 | Price validated across sources | PriceValidationEngine | `validate` | 124323996 | [`0xb0086f008f…`](https://testnet.bscscan.com/tx/0xb0086f008f05edb0cddd90735c520bb614c4bbffd673b157e054bba78e16941d) |
| 6 | RWA token issued 1:1 | RWAToken | `mint` | 124323999 | [`0xa1efc981b5…`](https://testnet.bscscan.com/tx/0xa1efc981b507c2fc75ae4b993781e0849d123e5812f60348cb48a0cfd387cd11) |
| 9 | Holder transfer | RWAToken | `transfer` | 124324002 | [`0x59a78e7cff…`](https://testnet.bscscan.com/tx/0x59a78e7cff372161e590683c2a6514fd4178c073a9d62d03eb896cc2c12a4df0) |
