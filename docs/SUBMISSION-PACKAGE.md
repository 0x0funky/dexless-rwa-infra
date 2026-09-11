# DEXless — BNB Chain 獎金送件材料

> 專案:**DEXless — Permissionless RWA Market Creation Layer**
> RWA 路線:**5(2) RWA Infra 類**(不直接發行資產,提供支持 RWA 上鏈的基礎能力)
> 補充:另完成 1 個資產的上鏈與 mint,一併提供 5(1) 說明
> 文件版本:v2 · **已完成 BNB Chain 主網部署**

---

## ⚠️ 本文件填寫狀態

標示 `【待補】` 的欄位為尚未完成的項目;標示 `【待法務】` 的欄位需律師與託管方
確認後填入,**不得填寫無法佐證的內容**。

**六顆合約已部署於 BNB Chain 主網(chainId 56)並完成 BscScan 原始碼驗證。**
定價管線已上線,以真實市場資料運行。測試網彩排記錄見附錄 A。

---

## 一、專案定位(30 秒理解)

RWA 上鏈真正的瓶頸不是「發行」,而是**定價**。

把資產鑄成 Token 只需要一個 ERC-20。困難的是:**這顆 Token 值多少錢?**
黃金、基金份額這類資產沒有 24/7 深度市場,現有作法都有結構性缺陷:

| 現行作法 | 失效原因 |
| --- | --- |
| 單一預言機餵價 | 單點故障;來源被操縱即全盤錯誤 |
| 單一 CEX 參考價 | 休市、下架、流動性枯竭即斷線 |
| 人工審核上架 | 中心化審批,數週流程,無法規模化 |

DEXless 的立場:**我們不相信任何單一價格,我們驗證市場。**

系統不預設任何來源可信,而是要求多個獨立來源在**鏈上**互相驗證,
並把整個驗證過程與每一筆拒絕理由寫成鏈上事件,任何人可稽核。

---

## 二、逐條對照獎金要求

### 要求 1 — 主網部署

**核心合約:`PriceValidationEngine`** — 產品關鍵邏輯,多來源價格的鏈上驗證引擎。

| 合約 | 職責 | 主網地址 |
| --- | --- | --- |
| `PriceValidationEngine` | **核心** — 五重驗證引擎 | [`0xcB37EFDC925200bEF595c9D8EbC7Ee7F69A1C6c0`](https://bscscan.com/address/0xcB37EFDC925200bEF595c9D8EbC7Ee7F69A1C6c0#code) |
| `MarketFactory` | 無需許可市場創建 | [`0xfC3bE79eEBeE5BC903218FA9AE6d18C64519D392`](https://bscscan.com/address/0xfC3bE79eEBeE5BC903218FA9AE6d18C64519D392#code) |
| `RWAAssetRegistry` | 資產登記 + 託管儲備證明 | [`0x59511F70Ab6EAD4b9c0518B0DA2Cf539e58533A4`](https://bscscan.com/address/0x59511F70Ab6EAD4b9c0518B0DA2Cf539e58533A4#code) |
| `ComplianceRegistry` | KYC / 身份 / 分級 | [`0x23488Dd95646473c091c04D0647D7445020778DE`](https://bscscan.com/address/0x23488Dd95646473c091c04D0647D7445020778DE#code) |
| `RWAToken` | 1:1 足額擔保代幣 | [`0x828c65a57473Ec4bad3303F63a6321Fa33a14c85`](https://bscscan.com/address/0x828c65a57473Ec4bad3303F63a6321Fa33a14c85#code) |
| `FeeDistributor` | 收益分配(Merkle) | [`0x0B01465b1288B91C0eDAa5DAF799eDEe3f43dd05`](https://bscscan.com/address/0x0B01465b1288B91C0eDAa5DAF799eDEe3f43dd05#code) |

部署成本實測:六顆合約共 **10,902,432 gas**,BSC 主網 0.05 gwei 下約 **0.00055 BNB**。

---

### 要求 2 — 合約驗證

全部六顆合約於 BscScan 完成原始碼驗證。

- 編譯器:`v0.8.24+commit.e11b9ed9`,optimizer 啟用(runs 200),evmVersion `shanghai`
- 驗證連結:上表每個地址點入即為已驗證原始碼(BscScan `#code` 分頁)
- 部署區塊:119141067 · 部署時間:2026-08-31T11:10:26.660Z
- 專案內附 `verification/` 目錄,含每顆合約的 Standard-Json-Input 與 ABI 編碼後的
  constructor 參數,任何人可獨立重現驗證

---

### 要求 3 — 功能性 MVP

**產品形態:dApp**(React 19 + Vite + wagmi/viem)

已實作並可互動:

| 功能 | 說明 |
| --- | --- |
| 即時儀表板 | 驗證後價格、**每個來源的鏈上判定**、風控參數、市場養熟進度 |
| 提案市場(四步) | 選資產 → 選價源 → 設風險參數 → 送出(附保證金) |
| 市場啟用 | 養熟達標後,**任何地址**皆可啟用 |
| 錢包連接 | MetaMask,自動偵測 BNB Chain 並提示切換 |

設計要點:表單送出前先 `simulate`,**會 revert 的交易不會讓使用者的錢包跳出來**,
錯誤以合約的具體錯誤名稱呈現。

**產品網址:**【待補 — 前端已完成並指向主網,待部署至公開網址】

程式碼位於本專案 `app/` 目錄,可於本機以 `npm run dev` 執行並直接連上主網合約。

---

### 要求 4 — 鏈上交互

#### (a) 多筆交易

定價管線(Keeper)每 15 分鐘執行一輪:5 個來源各推一筆報價 + 1 筆驗證 = 每輪 6 筆,
**約每日 576 筆**。這些是產品在運行,不是測試調用。

實際運行記錄(主網第 1 輪,2026-08-31):Binance 4432.00 / OKX 4431.45 /
Gate.io 4430.71 / Chainlink 4431.02 → 驗證通過 **4431.23**,4 個來源橫跨 2 種類別。
Pyth 當時回應 401,引擎以 `SourceRejected`(No quote)將其剔除並照常完成驗證 ——
單一資料商中斷不影響 feed 運作。

#### (b) 多個錢包地址交互

| 類別 | 說明 |
| --- | --- |
| 基礎設施錢包 | 5 個獨立報價者,各自對應一個真實資料來源,以各自的金鑰簽章 |
| 一般使用者錢包 | 提案、啟用、觸發驗證 —— 皆為無需許可操作 |

#### (c) 可驗證的真實用戶數量

【待補 — 封閉 Beta 尚未開始,參與者地址清單將於送件時附上】

> **誠實聲明:** 截至本文件版本,主網上的所有交易均來自專案自行操作的錢包。
> 其中**價格來源錢包屬於基礎設施**(每個協議都自行運行資料節點,且其推送的是
> Binance / OKX / Gate.io / Chainlink 的真實市場資料);標示為
> *project-operated* 的參與者錢包則是內部測試流程所用,**不計入真實用戶數**。
>
> 真實用戶數將以封閉 Beta 的獨立第三方地址計算,該等地址具有各自的鏈上歷史,
> 可逐一查核。我們不會以自行產生的錢包充數。

#### (d) 交互行為反映真實業務邏輯

| 鏈上動作 | 業務意義 |
| --- | --- |
| `submitQuote` × N | 各資料來源發布市場觀測值 |
| `validate` | 五重檢查 → 產生可信參考價 |
| `attestCustody` | 託管方申報儲備(Proof of Reserve) |
| `mint` | 依儲備 1:1 發行資產代幣 |
| `proposeMarket` / `activateMarket` | 資產的市場創建與上架 |
| `transfer` | 持有人之間的資產流轉 |
| `openRound` / `claim` | 收益分配 |

價格來源為**真實市場資料**,非合成數字:

| 來源 | 類別 | 資料 |
| --- | --- | --- |
| Binance PAXG/USDT | CEX | 聚合訂單簿(±50bps 內可成交深度) |
| OKX PAXG/USDT | CEX | 同上 |
| Gate.io PAXG/USDT | CEX | 同上 |
| Chainlink XAU/USD | ORACLE | BNB Chain 上的聚合器,約每 10 分鐘更新 |
| Pyth XAU/USD | ORACLE | Hermes,含信心區間 |

刻意配置**兩個獨立預言機**:三個 CEX 同屬一種來源類別,若唯一的預言機中斷,
整個 feed 會掉到只剩一種類別而無法通過跨源一致性檢查。Pyth 的公開端點已出現過
一次 401,Chainlink 直接讀鏈上資料,兩者互為備援。

實測一致性(2026-08-31):Binance 4452.04 / OKX 4452.50 / Gate.io 4452.44 /
Chainlink 4454.67 —— 相對中位數最大偏差 **5 bps**。

#### (e) 完整業務流程的鏈上執行記錄

```
① 資產登記        RWAAssetRegistry.registerAsset
② 託管儲備申報    RWAAssetRegistry.attestCustody
③ 建立價格來源    PriceValidationEngine.createFeed / addSource
④ 多來源報價      submitQuote × N
⑤ 鏈上驗證通過    validate → PriceValidated
⑥ 投資人認證      ComplianceRegistry.attest
⑦ 1:1 資產發行    RWAToken.mint
⑧ 市場提案        MarketFactory.proposeMarket
⑨ 養熟期驗證      (持續 validate)
⑩ 市場啟用        MarketFactory.activateMarket
⑪ 持有人轉讓      RWAToken.transfer
⑫ 收益分配        FeeDistributor.openRound → claim
⑬ 贖回銷毀        RWAToken.requestRedemption
```

逐筆交易雜湊與 BscScan 連結見 [`onchain-flow-bsc.md`](./onchain-flow-bsc.md),
由 `scripts/business-flow.ts` 於執行時自動產出。

---

### 要求 5(2) — RWA Infra 能力

本專案實作了要求列舉的**四項核心基礎能力**:

#### ① 數據上鏈模組(Oracle / API → on-chain)
**`PriceValidationEngine`** — 每筆報價須通過五道鏈上檢查:

1. **新鮮度** — 報價年齡 ≤ `maxStaleness`
2. **價差控制** — `(ask − bid) / mid` ≤ `maxSpreadBps`
3. **深度驗證** — 可成交名目 ≥ `minDepth`
4. **偏離度** — `|price − median| / median` ≤ `maxDeviationBps`
5. **跨源一致性** — 存活來源 ≥ `minSources`,且橫跨 ≥ `minDistinctKinds` 種來源類別

採**中位數**而非平均數(對單一離群值免疫)。連續失敗達門檻,Feed **自動暫停**供價。
每一筆拒絕都以 `SourceRejected` 事件寫上鏈,可完整回溯。

#### ② 資產驗證 / 審計機制
**`RWAAssetRegistry`** — 託管方定期上鏈申報儲備量;申報逾 35 天未更新,
資產自動失去可鑄造資格。法律文件存 IPFS,鏈上留 CID + keccak256 摘要。

#### ③ 合規 / KYC / 身份模組
**`ComplianceRegistry`** — 鏈下 KYC 由持牌機構執行,鏈上只寫**記錄雜湊**,個資永不上鏈。
支援投資人分級、效期、撤銷、司法管轄區封鎖。

#### ④ 資產發行工具(合約模板)
**`MarketFactory` + `RWAToken`** — 無需許可市場創建:任何人可提案,無人審批;
市場須通過「養熟期」(時間 + 乾淨驗證輪數)後,由**任何地址**啟用。

#### 真實鏈上調用記錄(非僅部署)
見要求 4(e) 及附錄 A。

#### 系統架構圖

```
鏈下資料層                  BNB Chain 主網                  執行層
──────────                 ──────────────                 ──────
造市商 RFQ  ─┐
CEX 訂單簿  ─┼─ submitQuote ─→ PriceValidationEngine ─┐
DEX 池      ─┤                 新鮮度·價差·深度        │
預言機      ─┘                 偏離度·跨源一致性        │
                                                        ├─→ MarketFactory ─→ Orderly
託管方 ───── attestCustody ──→ RWAAssetRegistry ───────┤    無需許可市場創建   共享流動性
                                    │                   │
KYC 機構 ─── attest ─────────→ ComplianceRegistry       │
                                    │                   │
                                    └──→ RWAToken ──────┘
                                         1:1 擔保
                                            │
                                            └──→ FeeDistributor
```

完整技術說明見 [`RWA-INFRA.md`](./RWA-INFRA.md)。

---

### 要求 5(1) — 資產上鏈(補充)

除 Infra 能力外,另完成一個資產的上鏈與 mint。

| 項目 | 內容 |
| --- | --- |
| 資產名稱 | 【待法務】 |
| 資產類別 | 【待法務】 |
| 發行主體 / 託管機構 | 【待法務】 |
| Token 代表權利 | 【待法務】 |
| 映射結構 | **1:1 足額擔保,由合約強制**(見下) |
| 數據上鏈方式 | IPFS(法律文件、儲備報告)+ 鏈上多來源驗證(價格) |

**1:1 擔保由合約強制,非政策承諾:**

```solidity
uint256 attested  = assetRegistry.attestedUnits(assetId);
uint256 newSupply = totalSupply() + amount;
if (newSupply > attested) revert ExceedsAttestedReserves(newSupply, attested);
```

鑄造量永遠不可能超過託管方最新申報的儲備量。任何人可呼叫 `backingRatioBps()`
查詢即時擔保率。

詳見 [`RWA-ASSET.md`](./RWA-ASSET.md)。

> **注意:** 該文件的法律欄位須經律師與託管方確認後填寫。本次發行採
> whitelist-only、不公開募集,並於 `ComplianceRegistry` 以合約強制執行。

---

## 三、提交材料清單

| # | 材料 | 位置 |
| --- | --- | --- |
| 1 | 合約地址 & BscScan 連結 | 本文「要求 1」「要求 2」 |
| 2 | Demo 影片 | 【待補】 |
| 3 | GitHub 連結 | 【待補 — repo 已建立,待推送】 |
| 4 | 產品連結 | 【待補 — 前端就緒,待部署】 |
| 5 | 鏈上交互數據網址 | [`onchain-activity-bsc.md`](./onchain-activity-bsc.md) + BscScan + 【Dune】 |
| 6 | RWA 說明文件 | [`RWA-INFRA.md`](./RWA-INFRA.md)(5-2)、[`RWA-ASSET.md`](./RWA-ASSET.md)(5-1) |

---

## 四、對照「不符合發放要求」之情形

| 不合格情形 | 本專案狀況 |
| --- | --- |
| (1) 無真實鏈上交互 | 定價管線持續運行,每日約 576 筆真實業務交易 |
| (2) 空合約或無實際功能 | 六顆合約、74 項自動化測試;引擎會實際剔除異常報價 |
| (3) 無資產映射邏輯 | `RWAToken` 於合約層強制 1:1,超額鑄造直接 revert |
| (4) 僅為展示用途的 NFT | 本專案無 NFT |
| (5) 無法驗證鏈上商業邏輯 | 完整生命週期逐筆交易可查;原始碼於 BscScan 驗證公開 |

---

## 五、已知限制(主動揭露)

我們認為誠實揭露比事後被發現更好:

1. **合約尚未經第三方安全審計。** 74 項自動化測試不等同審計。
   在承載重大真實資產價值前將補做。
2. **管理權限目前由單一地址持有。** 合約已實作權限分離
   (`DEFAULT_ADMIN_ROLE` 與操作角色可分離至不同地址),部署腳本亦支援多簽交接。
3. **KYC 服務商尚未簽約。** 合規模組已完整實作並運行,但目前的認證為內測性質,
   非法定 KYC 查核結果。
4. **造市商 RFQ 來源尚未接入。** 架構已預留 `MM_QUOTE` 來源類別,目前價格來源
   為 CEX 訂單簿與預言機。

---

## 附錄 A — 測試網驗證記錄(BSC Testnet, chainId 97)

主網部署前,完整系統已於測試網端到端驗證。

| 合約 | 地址 |
| --- | --- |
| PriceValidationEngine | `0xB69157314342e0eb5De62788F61E278c43e588B1` |
| MarketFactory | `0x9b881a2e8eb6De852931da7db2CdE53A26faBAf7` |
| RWAAssetRegistry | `0x515740C4293005292ABb7aEb920b08942E743eA0` |
| ComplianceRegistry | `0x7ba9dd9791bc64a782A874FA2A9d548791c098B5` |
| RWAToken | `0xCf5157c92d184cd8ec41FAc69746c4c4933Ec9B1` |
| FeeDistributor | `0xd804544EdDc01562e110a971095d002906d60460` |

已驗證的行為:

- 多來源真實價格上鏈,取中位數(Binance / OKX / Gate.io / Pyth)
- **偏離 40% 的操縱報價被正確剔除**(`SourceRejected`,原因 `Deviation exceeded`),
  且採用價格不受影響
- 多數來源遭操縱時,引擎**拒絕發布任何價格**而非採信薄弱來源集
- 資產登記 → 儲備申報 → 1:1 鑄造 → 市場提案 → 養熟 → 啟用 → 轉讓,全流程通過
- **零權限錢包成功提案市場**,並由**另一個錢包**啟用,保證金全額退回

> 測試網階段共 138 筆交易,均由專案自行操作的錢包產生,**不作為真實用戶佐證**。

---

*本文件隨主網部署進度更新。所有數據可於 BscScan 獨立查核。*
