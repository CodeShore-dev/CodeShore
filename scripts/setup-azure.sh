#!/usr/bin/env bash
# =============================================================================
# setup-azure.sh -- CodeShore Azure Container Apps 初始化（與 GCP / AWS 並存）
#
# 在 Azure 上建立 Container Apps 所需的基礎建設，並（選用）做一次首部署。
# 與 AWS EC2 路徑共用同一顆映像（Dockerfile.aws：frontend + backend，不裝 Chrome），
# 映像放在 ghcr.io（免費），Container Apps 直接拉。
#
# 對應資源：
#   Cloud Run / EC2        -> Azure Container Apps（scale-to-zero，永久免費月額度）
#   Artifact Registry/ECR  -> GitHub Container Registry (ghcr.io, 免費)
#   Cloud Build / Actions  -> .github/workflows/deploy-azure.yml
#   Secret Manager         -> GitHub Actions Secrets
#
# 註：此腳本為「選用」的本機 CLI 替代品。日常部署交給 deploy-azure.yml 即可，
#     不需本機 Azure CLI。本腳本只在你想用 CLI 手動建基礎建設時使用。
#
# Prerequisites:
#   1. Azure CLI 已安裝 (https://learn.microsoft.com/cli/azure/install-azure-cli)
#   2. az login 已登入
#   3. 已至少 build + push 過一次映像到 ghcr.io（或用 IMAGE=... 指定）
#
# Usage:
#   bash scripts/setup-azure.sh                          # 建基礎建設（不部署 app）
#   IMAGE=ghcr.io/<owner>/<repo>/codeshore:latest \
#   GHCR_USER=<github-user> GHCR_TOKEN=<PAT> \
#     bash scripts/setup-azure.sh --deploy               # 連同首部署
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

# ---- 可調整參數 ---------------------------------------------------------------
RESOURCE_GROUP="${RESOURCE_GROUP:-codeshore-rg}"
LOCATION="${LOCATION:-eastasia}"          # 東亞，離 GCP asia-east1 最近
ENVIRONMENT="${ENVIRONMENT:-codeshore-env}"
APP_NAME="${APP_NAME:-codeshore}"
TARGET_PORT="${TARGET_PORT:-8080}"        # bootstrap() 固定 listen 8080
IMAGE="${IMAGE:-}"

DEPLOY=false
[[ "${1:-}" == "--deploy" ]] && DEPLOY=true

echo ""
echo "============================================================"
echo "  CodeShore -- Azure Container Apps Initialization"
echo "============================================================"
echo "  Resource group : $RESOURCE_GROUP"
echo "  Location       : $LOCATION"
echo "  Environment    : $ENVIRONMENT"
echo "  App            : $APP_NAME"
echo ""

# ---- Step 0: 檢查 az 與登入 ---------------------------------------------------
command -v az &>/dev/null || error "找不到 az CLI，請先安裝 Azure CLI"
ACCOUNT=$(az account show --query name -o tsv 2>/dev/null) \
  || error "Azure 未登入，請先執行: az login"
success "Azure 已登入: $ACCOUNT"

# containerapp 擴充功能（不存在會自動裝）
az config set extension.use_dynamic_install=yes_without_prompt -o none

# ---- Step 1: Resource group --------------------------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 1 / 3: Resource group"
echo "------------------------------------------------------------"
if az group show -n "$RESOURCE_GROUP" >/dev/null 2>&1; then
  warn "Resource group '$RESOURCE_GROUP' 已存在，沿用"
else
  az group create -n "$RESOURCE_GROUP" -l "$LOCATION" -o none
  success "Resource group 建立完成: $RESOURCE_GROUP"
fi

# ---- Step 2: Container Apps environment --------------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 2 / 3: Container Apps environment"
echo "------------------------------------------------------------"
if az containerapp env show -n "$ENVIRONMENT" -g "$RESOURCE_GROUP" >/dev/null 2>&1; then
  warn "Environment '$ENVIRONMENT' 已存在，沿用"
else
  info "建立 environment（含 Log Analytics，免費額度 5GB/月）..."
  az containerapp env create -n "$ENVIRONMENT" -g "$RESOURCE_GROUP" -l "$LOCATION" -o none
  success "Environment 建立完成: $ENVIRONMENT"
fi

# ---- Step 3: Container App（選用首部署）--------------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 3 / 3: Container App"
echo "------------------------------------------------------------"
if [[ "$DEPLOY" == "true" ]]; then
  [[ -z "$IMAGE" ]] && error "--deploy 需要 IMAGE=ghcr.io/<owner>/<repo>/codeshore:<tag>"
  REG_ARGS=()
  if [[ -n "${GHCR_USER:-}" && -n "${GHCR_TOKEN:-}" ]]; then
    REG_ARGS=(--registry-server ghcr.io --registry-username "$GHCR_USER" --registry-password "$GHCR_TOKEN")
  else
    warn "未提供 GHCR_USER/GHCR_TOKEN：假設 ghcr.io 套件為公開，匿名拉取"
  fi

  if az containerapp show -n "$APP_NAME" -g "$RESOURCE_GROUP" >/dev/null 2>&1; then
    info "更新既有 Container App ..."
    az containerapp update -n "$APP_NAME" -g "$RESOURCE_GROUP" --image "$IMAGE" -o none
  else
    info "首次建立 Container App ..."
    az containerapp create -n "$APP_NAME" -g "$RESOURCE_GROUP" \
      --environment "$ENVIRONMENT" \
      --image "$IMAGE" \
      "${REG_ARGS[@]}" \
      --target-port "$TARGET_PORT" \
      --ingress external \
      --min-replicas 0 --max-replicas 1 \
      --cpu 0.5 --memory 1.0Gi \
      --env-vars NODE_ENV=production \
        SUPABASE_URL="${SUPABASE_URL:-}" \
        SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}" -o none
  fi
  FQDN=$(az containerapp show -n "$APP_NAME" -g "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn -o tsv)
  success "Container App 部署完成: https://$FQDN"
else
  info "略過首部署（未帶 --deploy）。基礎建設已就緒，後續交給 deploy-azure.yml。"
fi

# ---- 總結 --------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Setup 完成！"
echo "============================================================"
echo ""
echo "  接下來：建立 Service Principal 給 GitHub Actions（AZURE_CREDENTIALS）"
echo ""
echo "    SUB_ID=\$(az account show --query id -o tsv)"
echo "    az ad sp create-for-rbac --name codeshore-ci \\"
echo "      --role contributor \\"
echo "      --scopes /subscriptions/\$SUB_ID/resourceGroups/$RESOURCE_GROUP \\"
echo "      --sdk-auth"
echo ""
echo "  把上面輸出的整段 JSON 存成 GitHub Secret: AZURE_CREDENTIALS"
echo "  另需 Secrets：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /"
echo "               VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_ADMIN_EMAILS"
echo ""
echo "  然後 Actions -> Deploy to Azure (Container Apps) -> Run。"
echo "  部署後把 cloudflare/worker/main.js 的 azure 改成輸出的 FQDN。"
echo ""
