# BscScan manual verification — bscTestnet

No API key required. Do this once per contract.

## Settings (identical for all six)

| Field | Value |
| --- | --- |
| Compiler Type | **Solidity (Standard-Json-Input)** |
| Compiler Version | `v0.8.24+commit.e11b9ed9` |
| Open Source License | MIT |

Optimizer settings are already inside the JSON — do not re-enter them.

## Steps

1. Open the contract's verify URL below.
2. Pick **Solidity (Standard-Json-Input)** and compiler `v0.8.24+commit.e11b9ed9`.
3. Upload that contract's `*.standard-input.json`.
4. Paste the Constructor Arguments string (no leading `0x`). Skip if "none".
5. Submit. Verification usually completes in under a minute.

Once `ETHERSCAN_API_KEY` is available, `npm run verify:testnet` does all six automatically instead.

## Contracts

### ComplianceRegistry

- **Address**: `0x7ba9dd9791bc64a782A874FA2A9d548791c098B5`
- **BscScan**: https://testnet.bscscan.com/verifyContract?a=0x7ba9dd9791bc64a782A874FA2A9d548791c098B5
- **Contract name**: `contracts/registry/ComplianceRegistry.sol:ComplianceRegistry`
- **Standard-Json-Input**: `ComplianceRegistry.standard-input.json`
- **Constructor Arguments** (from `ComplianceRegistry.args.txt`):

  ```
  0000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb0030
  ```

### RWAAssetRegistry

- **Address**: `0x515740C4293005292ABb7aEb920b08942E743eA0`
- **BscScan**: https://testnet.bscscan.com/verifyContract?a=0x515740C4293005292ABb7aEb920b08942E743eA0
- **Contract name**: `contracts/registry/RWAAssetRegistry.sol:RWAAssetRegistry`
- **Standard-Json-Input**: `RWAAssetRegistry.standard-input.json`
- **Constructor Arguments** (from `RWAAssetRegistry.args.txt`):

  ```
  0000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb0030
  ```

### PriceValidationEngine

- **Address**: `0xB69157314342e0eb5De62788F61E278c43e588B1`
- **BscScan**: https://testnet.bscscan.com/verifyContract?a=0xB69157314342e0eb5De62788F61E278c43e588B1
- **Contract name**: `contracts/core/PriceValidationEngine.sol:PriceValidationEngine`
- **Standard-Json-Input**: `PriceValidationEngine.standard-input.json`
- **Constructor Arguments** (from `PriceValidationEngine.args.txt`):

  ```
  0000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb0030
  ```

### MarketFactory

- **Address**: `0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7`
- **BscScan**: https://testnet.bscscan.com/verifyContract?a=0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7
- **Contract name**: `contracts/core/MarketFactory.sol:MarketFactory`
- **Standard-Json-Input**: `MarketFactory.standard-input.json`
- **Constructor Arguments** (from `MarketFactory.args.txt`):

  ```
  0000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb0030000000000000000000000000b69157314342e0eb5de62788f61e278c43e588b1000000000000000000000000515740c4293005292abb7aeb920b08942e743ea00000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb0030000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000001f400000000000000000000000000000000000000000000000000000000000000fa000000000000000000000000000000000000000000000000000000000000012c00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000093a80000000000000000000000000000000000000000000000000002386f26fc10000
  ```

### RWAToken

- **Address**: `0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1`
- **BscScan**: https://testnet.bscscan.com/verifyContract?a=0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1
- **Contract name**: `contracts/token/RWAToken.sol:RWAToken`
- **Standard-Json-Input**: `RWAToken.standard-input.json`
- **Constructor Arguments** (from `RWAToken.args.txt`):

  ```
  00000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120722fdcc192a010e94de980083962e9e2bc6f19d64a9cb828ebc10ad4f51d87eb000000000000000000000000515740c4293005292abb7aeb920b08942e743ea00000000000000000000000007ba9dd9791bc64a782a874fa2a9d548791c098b500000000000000000000000000000000000000000000000000000000000000010000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb003000000000000000000000000000000000000000000000000000000000000000164445586c65737320416c6c6f636174656420476f6c640000000000000000000000000000000000000000000000000000000000000000000000000000000000046458415500000000000000000000000000000000000000000000000000000000
  ```

### FeeDistributor

- **Address**: `0xd804544EdDc01562e110a971095d002906d60460`
- **BscScan**: https://testnet.bscscan.com/verifyContract?a=0xd804544EdDc01562e110a971095d002906d60460
- **Contract name**: `contracts/token/FeeDistributor.sol:FeeDistributor`
- **Standard-Json-Input**: `FeeDistributor.standard-input.json`
- **Constructor Arguments** (from `FeeDistributor.args.txt`):

  ```
  0000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb00300000000000000000000000006ccb3d1a6019c3fe0c3a8fd50142a2d3bccb0030
  ```
