#!/usr/bin/env bash
# =============================================================================
# setup-aws-lambda.sh -- CodeShore AWS Lambda 初始化（一次性基礎建設）
#
# 建立 Lambda 容器部署所需的「不會變動」資源：
#   - ECR repository（Lambda 容器映像只能放 ECR，不能用 ghcr）
#   - Lambda 執行角色（IAM role）
# 之後 .github/workflows/deploy-aws-lambda.yml 會自動 build/push 映像、
# 並在第一次部署時建立 Lambda function + Function URL。
#
# 對應 GCP：
#   Cloud Run         -> AWS Lambda（容器映像，scale-to-zero，永久免費額度）
#   Artifact Registry -> Amazon ECR
#   Cloud Build       -> GitHub Actions
#   Secret Manager    -> GitHub Actions Secrets（部署時寫入 Lambda 環境變數）
#
# Prerequisites: AWS CLI v2 已安裝且 aws configure 完成
# Usage: bash scripts/setup-aws-lambda.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

REGION="${AWS_REGION:-ap-northeast-1}"
ECR_REPO="codeshore"
ROLE_NAME="codeshore-lambda-role"

echo ""
echo "============================================================"
echo "  CodeShore -- AWS Lambda Initialization"
echo "============================================================"
echo "  Region    : $REGION"
echo "  ECR repo  : $ECR_REPO"
echo "  Role name : $ROLE_NAME"
echo ""

command -v aws &>/dev/null || error "找不到 aws CLI，請先安裝 AWS CLI v2"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) \
  || error "AWS 未登入，請先執行: aws configure"
success "AWS 已登入，帳號: $ACCOUNT_ID"

# ---- Step 1: ECR repository --------------------------------------------------
echo ""
echo "  Step 1 / 2: ECR repository"
if aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$REGION" &>/dev/null; then
  warn "ECR repo '$ECR_REPO' 已存在，跳過"
else
  aws ecr create-repository --repository-name "$ECR_REPO" --region "$REGION" \
    --image-scanning-configuration scanOnPush=false >/dev/null
  success "ECR repo 建立完成"
fi
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

# ---- Step 2: Lambda 執行角色 -------------------------------------------------
echo ""
echo "  Step 2 / 2: Lambda 執行角色 (IAM role)"
if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
  warn "Role '$ROLE_NAME' 已存在，跳過"
else
  TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" >/dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null
  success "Role 建立完成並附加 AWSLambdaBasicExecutionRole"
fi
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

# ---- 總結 --------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Lambda 基礎建設完成！"
echo "============================================================"
echo ""
echo "  ECR URI  : $ECR_URI"
echo "  Role ARN : $ROLE_ARN"
echo ""
echo "  接下來：設定 GitHub Actions Secrets（Repo -> Settings -> Secrets and variables -> Actions）"
echo "    AWS_ACCESS_KEY_ID          = (IAM user，需有 ECR + Lambda 權限)"
echo "    AWS_SECRET_ACCESS_KEY      = ..."
echo "    AWS_REGION                 = $REGION"
echo "    LAMBDA_ROLE_ARN            = $ROLE_ARN"
echo "    VITE_SUPABASE_URL          = ..."
echo "    VITE_SUPABASE_ANON_KEY     = ..."
echo "    VITE_ADMIN_EMAILS          = ..."
echo "    SUPABASE_URL               = ..."
echo "    SUPABASE_SERVICE_ROLE_KEY  = ..."
echo ""
echo "  然後 push 到 main（或手動 Run workflow: Deploy to AWS Lambda）。"
echo "  第一次部署會自動建立 Lambda function 與 Function URL，並在 log 印出網址。"
echo "  拿到 Function URL 後，填回 cloudflare/worker/main.js 的 aws 欄位即可。"
echo ""
