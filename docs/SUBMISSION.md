# BNB Chain 獎金送件檢查表

死線 **2026-09-30**。建議 **2026-09-08 前送出**，預留三週補件緩衝。

---

## 逐條對照

### 1. 主網部署 ✅ 可交付
至少一個核心合約部署於 BNB Chain 主網，且為產品關鍵邏輯。

本專案部署 6 個合約，`PriceValidationEngine` 為產品核心（「我們不相信價格，我們驗證市場」）。

- [ ] `npm run deploy:mainnet`
- [ ] 位址記錄於 `deployments/bsc.json`

### 2. 合約驗證 ✅ 可交付
- [ ] `npm run verify:mainnet`
- [ ] 6 個合約在 BscScan 皆顯示綠勾

### 3. 功能性 MVP ⚠️ 需前端
需要可實際互動的 dApp。合約與腳本已就緒，**前端尚未建置**。

- [ ] 最小 dApp：連錢包 → 看 Feed 即時驗證狀態 → 提案市場 → 查詢持倉
- [ ] 部署至 app.dexless.exchange

### 4. 鏈上互動 ⚠️ 需真實用戶
最容易被駁回的一項。要求：多筆交易、多個地址、可驗證真實用戶數、真實業務邏輯、
至少一個完整業務流程的鏈上記錄。

- [ ] Keeper 持續運行（每 5 分鐘一輪 ≈ 每日 288 筆真實定價交易）
- [ ] 封閉 Beta：目標 **50–200 個真實地址**
- [ ] 每個地址對應一筆 `ComplianceRegistry` 認證 → `totalAttested()` 即鏈上可驗證用戶數
- [ ] 完整業務流程記錄：`npm run flow:mainnet` → 產出 `docs/onchain-flow.md`

**絕對不要做**：用單一熱錢包 fan-out 打 BNB 給大量新地址再互轉。
鏈上分析一眼看穿，直接觸犯第 7 條。BSC 單筆 gas 約 $0.01–0.05，真實用戶自付即可。

### 5. RWA 要求 ✅ 文件已備
- [ ] 5(2) 技術說明 → `docs/RWA-INFRA.md`（已完成）
- [ ] 5(1) 資產說明 → `docs/RWA-ASSET.md`（**範本，須補齊法律欄位**）

### 6. 提交材料
| # | 材料 | 狀態 |
| --- | --- | --- |
| 1 | 合約位址 & BscScan 連結 | `npm run verify:mainnet` 自動產出表格 |
| 2 | Demo 影片 | ⚠️ 待錄，3–5 分鐘走完整流程並帶到 BscScan |
| 3 | GitHub 連結 | ⚠️ 待建 public repo |
| 4 | 產品連結 | ⚠️ 待部署前端 |
| 5 | 鏈上交互數據網址 | ⚠️ 待建 Dune dashboard + `docs/onchain-flow.md` |
| 6 | RWA 說明文件 | ✅ `docs/RWA-INFRA.md` + `docs/RWA-ASSET.md` |

### 7. 不符合發放的情形 — 自我檢查
- [ ] 有真實鏈上交互（非僅部署）→ Keeper + Beta 用戶
- [ ] 非空合約 → 6 個合約 74 項測試
- [ ] 有資產映射邏輯 → `RWAToken` 合約層強制 1:1
- [ ] 非展示用 NFT → 無 NFT
- [ ] 鏈上商業邏輯可驗證 → 完整流程 tx hash 表

---

## 上主網前的必辦事項

### 🔴 立即（本週）
1. **寄信給主辦方確認路線** —— 附一頁說明走 5(2) Infra 路線與交付清單，
   取得**書面確認符合資格**。這封信的價值大於後面兩個月所有工作。
2. **確認智能合約人力** —— deck 團隊三人為 Founder / COO / CTO(AI)，
   無 Solidity 工程師。上主網前需要有人能維運。

### 🔴 上主網前必改
1. **`ADMIN_ADDRESS` 換成 Gnosis Safe 多簽** ——
   目前 `DEFAULT_ADMIN_ROLE` 由單一 EOA 持有，這是任何審計都會開的第一個 finding。
2. **報價來源分離金鑰** —— 每個 source 用獨立的 key。
   共用一把 key 會讓跨源一致性檢查失去意義。
3. **填齊 `scripts/config.ts` 中的 `REPLACE_WITH_*`** ——
   法律文件 CID 與摘要必須是真的。
4. **考慮外部審計** —— 若要承載真實資產價值，74 項測試不能取代審計。
   預算有限時，至少做一次 Code4rena/Sherlock 之類的輕量競賽或社群 review。

### 🟡 時程建議
| 週次 | 工作 |
| --- | --- |
| 7/22–7/28 | 主辦方書面確認、確認人力、JEPUN 資料源談定 |
| 7/29–8/11 | 前端 dApp、Keeper 資料源接通、測試網全流程演練 |
| 8/12–8/18 | **主網部署 + BscScan 驗證** |
| 8/19–9/01 | 封閉 Beta 累積真實互動、Dune dashboard |
| 9/02–9/08 | 文件、Demo 影片、整包送件 |
| 9/09–9/30 | 緩衝，回應補件 |
