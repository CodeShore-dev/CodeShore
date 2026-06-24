# AWS 部署指南（與 GCP 並存，免費限制下）

把目前跑在 GCP Cloud Run 的同一套服務，也部署到 AWS，**GCP 維持原狀不受影響**。
**AWS 端不跑 Chrome 爬蟲**（爬蟲在本地跑），所以容器只負責 NestJS backend：serve 前端靜態檔 + `/api`。

提供 **兩種** AWS 方案，可擇一或併用：

| | 方案 A：EC2（all-in-one） | 方案 B：Lambda + S3/CloudFront（拆分） |
|--|------------|----------------|
| 對應 GCP | Cloud Run（長駐容器，自己 serve 前端 + API） | Cloud Run 拆成「靜態 + serverless API」 |
| 前端 | 由容器一起 serve | **S3 + CloudFront**（CDN/HTTPS） |
| 後端 API | 同一容器 | **Lambda 純 API**（scale-to-zero） |
| 免費額度 | t3.micro 750hr/月，**前 12 個月** | Lambda 100萬次+400k GB-秒/月（永久）；CloudFront 1TB+1000萬請求/月（永久）；S3 幾 MB ≈ 0 |
| 映像儲存 | ghcr.io（免費） | Amazon ECR（前 12 個月 500MB/月） |
| 程式碼改動 | 無 | 多一個 handler 入口 `lambda.ts`（已完成，前端零改動） |
| 適合 | 最單純、和 GCP 幾乎一樣 | 永久免費 + CDN 加速 + 用多少付多少 |

> 兩種方案都已驗證可 build。Lambda handler 已在本機實測：Nest 能在不 listen 模式啟動、`GET /api` 回傳 200，且前端目錄不存在也不會崩。
> 前端生產環境用 `window.location.origin` 打 `/api`（[constants.ts](../apps/frontend/src/httpClient/constants.ts)），所以 CloudFront 用 path 把 `/api/*` 導到 Lambda、其餘導到 S3 即可同源運作、**無 CORS、前端不需改**。

## 環境如何共存

- **GCP**：`Dockerfile.cloudrun` + `cloudbuild.yaml`（原封不動）。
- **AWS EC2（方案 A）**：`Dockerfile.aws` + `.github/workflows/deploy-aws.yml`（容器自己 serve 前端 + API）。
- **AWS Lambda（方案 B 後端）**：`Dockerfile.lambda`（**純 API**）+ `.github/workflows/deploy-aws-lambda.yml`。
- **AWS 前端（方案 B 前端）**：`scripts/setup-aws-s3-cloudfront.sh` + `.github/workflows/deploy-aws-frontend.yml`。
- 共用程式碼：`service-utils` 拆出 `createApp()`（設定好但不 listen），`bootstrap()`（GCP/EC2 用，會 listen）與 `lambda.ts`（Lambda 用）都呼叫它，邏輯一致。
- `cloudflare/worker/main.js` 用完整 origin 路由：`gcp.codeshore.dev` / `aws.codeshore.dev`，把 `ACTIVE_BACKEND` 切到誰就走誰。

---

## 應用層 Secrets（值可從 GCP Secret Manager 撈，例如 `gcloud secrets versions access latest --secret=supabase-url`）

| Secret | 用在哪 |
|--------|--------|
| `VITE_APP_TITLE` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_ADMIN_EMAILS` | 前端 build（方案 A 的 EC2 image；方案 B 的前端 S3 workflow） |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 後端 runtime（EC2 / Lambda） |

各方案另需的基礎建設 Secrets（`EC2_*` / `AWS_*` / `LAMBDA_ROLE_ARN` / `S3_BUCKET` / `CLOUDFRONT_DISTRIBUTION_ID`）列在下方各自段落。

---

## 方案 A：EC2

1. `aws configure`（建議 region `ap-northeast-1` 東京）
2. `bash scripts/setup-aws.sh` —— 建立 EC2 + 防火牆 + 裝 Docker，輸出 Public IP/DNS、產生 `codeshore-key.pem`（已 gitignore）
3. 額外 GitHub Secrets：
   - `EC2_HOST` = Public IP
   - `EC2_SSH_KEY` = `codeshore-key.pem` 完整內容
4. push 到 `main` → `deploy-aws.yml` 自動 build（ghcr.io）→ SSH 進 EC2 重啟容器
5. 把 `cloudflare/worker/main.js` 的 `aws` 改成 `'http://<EC2_PUBLIC_DNS>:8080'`，重新部署 worker

> EC2 origin 是純 http，若 Cloudflare SSL 模式為 Full，該 route 請設為 **Flexible**。

---

## 方案 B：Lambda + S3/CloudFront（拆分）

**workflow 會自動建立 ECR / S3 / CloudFront**（不存在才建），所以你**不需要本機 AWS CLI**，
Console 只要手動做兩件事：建 IAM 使用者、建 Lambda 執行角色。其餘交給 GitHub Actions。

> 大前提：所有檔案（尤其 `.github/workflows/*.yml`）要先 commit + push 到 GitHub，Actions 才會跑。

### B-1. Console 手動（一次性，兩件事）
1. **IAM 使用者**（給 Actions 用的金鑰）：IAM → Users → 建 `codeshore-ci`，附加
   `AmazonEC2ContainerRegistryFullAccess`、`AWSLambda_FullAccess`、`AmazonS3FullAccess`、`CloudFrontFullAccess`
   → Create access key（Application running outside AWS）→ 記下 key / secret。
2. **Lambda 執行角色**：IAM → Roles → 建 `codeshore-lambda-role`，trusted entity = Lambda，
   附加 `AWSLambdaBasicExecutionRole` → 複製 Role ARN。

### B-2. GitHub Secrets
```
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   # B-1 的金鑰
AWS_REGION = ap-northeast-1
LAMBDA_ROLE_ARN                              # B-1 的 Role ARN
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY    # 後端 runtime
VITE_APP_TITLE / VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_ADMIN_EMAILS  # 前端 build
```
> 不再需要 `S3_BUCKET` / `CLOUDFRONT_DISTRIBUTION_ID`：前端 workflow 會自動推導/建立。

### B-3. 部署（先後端、再前端）
1. **後端**：Actions → **Deploy to AWS Lambda** → Run。首次會自動建 ECR repo、建 Lambda function + Function URL。
2. **前端**：Actions → **Deploy frontend to AWS (S3 + CloudFront)** → Run。
   首次會自動建 S3 bucket + CloudFront（抓 Lambda Function URL 當 `/api` origin），
   並在 workflow summary 印出 **CloudFront 網址**。
3. 把 `cloudflare/worker/main.js` 的 `aws` 改成 `'https://<CloudFront 網址>'`，重新部署 worker。

> 順序重要：CloudFront 的 `/api` origin 需要 Lambda Function URL，所以一定先跑後端。
> CloudFront 首次建立後需 5-15 分鐘才會 ready。

### （選用）改用本機 CLI
若之後你裝了 AWS CLI，也可改用腳本一次建好基礎建設：
`bash scripts/setup-aws-lambda.sh`、`bash scripts/setup-aws-s3-cloudfront.sh`（效果與 workflow 自動建相同）。

---

## 驗證

```bash
# EC2（方案 A）
curl http://<EC2_PUBLIC_IP>:8080/api

# Lambda + CloudFront（方案 B）
curl https://<cloudfront-domain>/api      # /api -> Lambda
curl https://<cloudfront-domain>/         # 前端 SPA -> S3
```

## 備註
- t3.micro / Lambda 1GB 記憶體都夠：image 在 GitHub Actions 上 build，不佔運算資源。
- 後台「手動觸發爬蟲」按鈕在 AWS 上會失效（沒有 `dist/apps/crawler`），其餘功能正常 —— 符合「爬蟲本地跑」的設計。
