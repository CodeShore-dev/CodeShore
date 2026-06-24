# Azure 部署指南（與 GCP / AWS 並存，免費限制下）

把目前跑在 GCP Cloud Run 的同一套服務，也部署到 Azure，**GCP / AWS 維持原狀不受影響**。
**Azure 端不跑 Chrome 爬蟲**（爬蟲在本地跑），所以容器只負責 NestJS backend：serve 前端靜態檔 + `/api`。

採用 **Azure Container Apps**（對應 GCP Cloud Run 的長駐容器模型）：

| | Azure Container Apps（本方案） |
|--|------------|
| 對應 GCP | Cloud Run（長駐容器，自己 serve 前端 + API） |
| 對應 AWS | EC2 方案（all-in-one 容器），但 **scale-to-zero + 永久免費** |
| 前端 | 由容器一起 serve（同 `Dockerfile.aws`） |
| 後端 API | 同一容器 |
| 免費額度 | 每月 **18萬 vCPU-秒 + 36萬 GiB-秒 + 200萬請求**（永久，scale-to-zero） |
| 映像儲存 | ghcr.io（免費，**與 AWS EC2 路徑共用同一顆映像**） |
| 程式碼改動 | **無**（重用 `Dockerfile.aws` 與 `bootstrap()`） |

> 為什麼可重用 `Dockerfile.aws`：該映像 build `frontend + backend`、不裝 Chrome、`bootstrap()` 固定 listen `8080`。
> Container Apps 把 ingress `targetPort` 設成 `8080` 即可。前端生產環境用 `window.location.origin` 打 `/api`
> （[constants.ts](../apps/frontend/src/httpClient/constants.ts)），同源、無 CORS、前端零改動。

## 環境如何共存

- **GCP**：`Dockerfile.cloudrun` + `cloudbuild.yaml`（原封不動）。
- **AWS**：`Dockerfile.aws` / `Dockerfile.lambda` + `deploy-aws*.yml`（原封不動）。
- **Azure**：`Dockerfile.aws`（共用）+ `.github/workflows/deploy-azure.yml`。
- 共用程式碼：`service-utils` 的 `createApp()`（設定好但不 listen）與 `bootstrap()`（會 listen，GCP / EC2 / Container Apps 共用）。
- `cloudflare/worker/main.js` 用完整 origin 路由：`gcp.codeshore.dev` / `aws.codeshore.dev` / `azure.codeshore.dev`。

---

## 應用層 Secrets（值可從 GCP Secret Manager 撈）

| Secret | 用在哪 |
|--------|--------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_ADMIN_EMAILS` | 前端 build（打包進 JS bundle） |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 後端 runtime |

基礎建設另需 `AZURE_CREDENTIALS`（Service Principal JSON），見下方。

---

## 部署步驟

**workflow 會自動建立 resource group / environment / Container App**（不存在才建），
所以你**不需要本機 Azure CLI**。只要做一次性的 Service Principal，其餘交給 GitHub Actions。

> 大前提：所有檔案（尤其 `.github/workflows/*.yml`）要先 commit + push 到 GitHub，Actions 才會跑。

### 1. 註冊資源供應者（一次性，需訂閱 Owner/Contributor）

Container Apps 第一次使用需要在**訂閱層級**註冊資源供應者。RG-scoped 的 Service Principal
**沒有**訂閱層權限做這件事（會報 `AuthorizationFailed: Microsoft.App/register/action`），
所以要先用你自己的帳號在 [Azure Portal Cloud Shell](https://portal.azure.com/#cloudshell/) 註冊一次：

```bash
az provider register -n Microsoft.App --wait   # Container Apps 本體
```

> 約 1～2 分鐘，跑完應印出 `Registered`。註冊是訂閱層一次性動作，之後永遠不用再做。
> 本方案 environment 用 `--logs-destination none`（不建 Log Analytics），故**不需**註冊 `Microsoft.OperationalInsights`。

### 2. 建立 Service Principal（一次性）

接著在同一個 Cloud Shell（或本機 `az login` 後）執行：

```bash
SUB_ID=$(az account show --query id -o tsv)
az group create -n codeshore-rg -l eastasia       # 先建好 RG，把 SP 權限限縮在此 RG
az ad sp create-for-rbac --name codeshore-ci \
  --role contributor \
  --scopes /subscriptions/$SUB_ID/resourceGroups/codeshore-rg \
  --sdk-auth
```

把輸出的**整段 JSON**（含 `clientId` / `clientSecret` / `subscriptionId` / `tenantId`）存成 GitHub Secret `AZURE_CREDENTIALS`。

### 3. GitHub Secrets

```
AZURE_CREDENTIALS                            # 上一步的 JSON
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY     # 後端 runtime
VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_ADMIN_EMAILS  # 前端 build
```

> 不需要額外的 registry secret：映像推到 ghcr.io 用內建的 `GITHUB_TOKEN`。

### 4. 部署

Actions → **Deploy to Azure (Container Apps)** → Run。
首次會自動建 resource group + environment + Container App，並在 workflow summary 印出 **FQDN**。

### 5. 接上 Cloudflare

把 `cloudflare/worker/main.js` 的 `azure` 改成輸出的 FQDN（去掉結尾 `/`），重新部署 worker：

```js
const BACKENDS = {
  gcp:   'codeshore-ppbtmrwfxa-de.a.run.app',
  azure: '<your-app>.<region>.azurecontainerapps.io',   // ← 填這裡
  aws:   'd2mbhmftzmon28.cloudfront.net/',
};
```

要把流量切到 Azure，再把 `ACTIVE_BACKEND` 設為 `'azure'`（或直接用 `azure.codeshore.dev` 子網域測試）。

---

## ⚠️ GHCR 私有套件與 scale-to-zero

Container Apps 設定 `min-replicas=0`，閒置時縮到零，**之後有請求才會重新拉映像**。
workflow 建立時帶的 `GITHUB_TOKEN` 是短效的（job 結束就失效），日後 scale-from-zero 重拉可能因憑證過期失敗。二擇一：

- **（建議，永久免費友善）** 把 ghcr.io 上的 `codeshore` 套件設為 **public**
  （GitHub → Packages → 該 package → Package settings → Change visibility → Public）。
  公開後 Container Apps 匿名拉取，永遠不會過期。
- 或建立長效 PAT（`read:packages`），在 workflow 改用該 secret 當 `--registry-password`。

---

## 驗證

```bash
curl https://<fqdn>/api      # 後端 /api
curl https://<fqdn>/         # 前端 SPA
```

## 成本與 log
- environment 用 `--logs-destination none`：**不建 Log Analytics workspace**，徹底避開「log 寫入超過 5GB/月」的計費風險。
- 搭配 `min-replicas=0`（閒置縮到零）與 Container Apps 永久免費月額度，低流量下基本為 **$0**。
- 沒有 Log Analytics 不影響除錯：即時 log 用 `az containerapp logs show -n codeshore -g codeshore-rg --follow` 看（只是沒有可查詢的歷史儲存）。
- 仍建議到 Cost Management → Budgets 設個每月小額預算 + email 警示，求安心。

## 備註
- `cpu 0.5 / memory 1.0Gi` 對純 serve 前端 + /api 綽綽有餘；映像在 GitHub Actions 上 build，不佔 Azure 運算資源。
- 後台「手動觸發爬蟲」按鈕在 Azure 上會失效（映像不含 `dist/apps/crawler`），其餘功能正常 —— 符合「爬蟲本地跑」的設計。
- 選用：若你已裝 Azure CLI，可改用 `bash scripts/setup-azure.sh` 一次建好基礎建設（效果與 workflow 自動建相同）。
