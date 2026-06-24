#!/usr/bin/env bash
# =============================================================================
# setup-aws.sh -- CodeShore AWS Initialization Script (Bash)
#
# 在 AWS 上建立一台 free-tier EC2，安裝 Docker，並開好防火牆，
# 之後由 GitHub Actions (.github/workflows/deploy-aws.yml) 自動部署容器。
#
# 對應 GCP 資源：
#   Cloud Run            -> EC2 t3.micro (free-tier, 直接 docker run 同一個容器)
#   Artifact Registry    -> GitHub Container Registry (ghcr.io, 免費)
#   Cloud Build (trigger)-> GitHub Actions
#   Secret Manager       -> GitHub Actions Secrets（部署時寫入 EC2 的 .env）
#
# Prerequisites:
#   1. AWS CLI v2 已安裝 (https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
#   2. aws configure 已設定好 Access Key / 預設 region
#   3. 帳號有 EC2 建立權限
#
# Usage: bash scripts/setup-aws.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

# ---- 可調整參數 ---------------------------------------------------------------
REGION="${AWS_REGION:-ap-northeast-1}"   # 預設東京（離 GCP asia-east1 最近）
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"  # free-tier: t3.micro 或 t2.micro（視 region）
NAME="codeshore"
SG_NAME="${NAME}-sg"
KEY_NAME="${NAME}-key"
TAG="${NAME}-app"
APP_PORT=8080

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "============================================================"
echo "  CodeShore -- AWS Initialization Script"
echo "============================================================"
echo "  Region        : $REGION"
echo "  Instance type : $INSTANCE_TYPE (free-tier eligible)"
echo ""

# ---- Step 0: 檢查 AWS CLI 與登入 ----------------------------------------------
command -v aws &>/dev/null || error "找不到 aws CLI，請先安裝 AWS CLI v2"
CALLER=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null) \
  || error "AWS 未登入或憑證無效，請先執行: aws configure"
success "AWS 已登入: $CALLER"

# ---- Step 1: SSH Key Pair ----------------------------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 1 / 5: SSH Key Pair"
echo "------------------------------------------------------------"
KEY_FILE="$PROJECT_ROOT/${KEY_NAME}.pem"
if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
  warn "Key pair '$KEY_NAME' 已存在，沿用既有的"
  [[ -f "$KEY_FILE" ]] || warn "找不到本機 $KEY_FILE，若要 SSH 需自行保管原始私鑰"
else
  info "建立 key pair: $KEY_NAME ..."
  aws ec2 create-key-pair --key-name "$KEY_NAME" --region "$REGION" \
    --query 'KeyMaterial' --output text > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  success "私鑰已存到 $KEY_FILE （請妥善保管，並加入 .gitignore）"
fi

# ---- Step 2: Security Group --------------------------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 2 / 5: Security Group (防火牆)"
echo "------------------------------------------------------------"
VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text --region "$REGION")
[[ "$VPC_ID" == "None" || -z "$VPC_ID" ]] && error "找不到 default VPC"

SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$SG_NAME" \
  --query 'SecurityGroups[0].GroupId' --output text --region "$REGION" 2>/dev/null || true)

if [[ "$SG_ID" == "None" || -z "$SG_ID" ]]; then
  info "建立 security group: $SG_NAME ..."
  SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" \
    --description "CodeShore app SG" --vpc-id "$VPC_ID" \
    --query 'GroupId' --output text --region "$REGION")
  MYIP=$(curl -s https://checkip.amazonaws.com || echo "0.0.0.0")
  # SSH 只開放給你目前的 IP
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port 22 --cidr "${MYIP}/32" --region "$REGION" >/dev/null
  # App port 對外開放（前面有 Cloudflare 代理）
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port "$APP_PORT" --cidr 0.0.0.0/0 --region "$REGION" >/dev/null
  success "Security group 建立完成: $SG_ID (SSH=$MYIP/32, app=$APP_PORT/0.0.0.0)"
else
  warn "Security group '$SG_NAME' 已存在: $SG_ID"
fi

# ---- Step 3: 找最新 Amazon Linux 2023 AMI ------------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 3 / 5: 選擇 AMI"
echo "------------------------------------------------------------"
AMI_ID=$(aws ssm get-parameters \
  --names /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameters[0].Value' --output text --region "$REGION")
success "Amazon Linux 2023 AMI: $AMI_ID"

# ---- Step 4: 啟動 EC2（user-data 自動裝 Docker）------------------------------
echo ""
echo "------------------------------------------------------------"
echo "  Step 4 / 5: 啟動 EC2 instance"
echo "------------------------------------------------------------"

EXISTING=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$TAG" "Name=instance-state-name,Values=running,pending,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text --region "$REGION" 2>/dev/null || true)

if [[ "$EXISTING" != "None" && -n "$EXISTING" ]]; then
  warn "已存在 instance ($EXISTING)，跳過建立"
  INSTANCE_ID="$EXISTING"
else
  USER_DATA=$(cat <<'EOF'
#!/bin/bash
dnf update -y
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user
EOF
)
  info "啟動 $INSTANCE_TYPE ..."
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --user-data "$USER_DATA" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$TAG}]" \
    --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3}' \
    --query 'Instances[0].InstanceId' --output text --region "$REGION")
  success "Instance 已建立: $INSTANCE_ID（等待開機與 Docker 安裝約 1-2 分鐘）"
fi

info "等待 instance 進入 running 狀態 ..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

PUBLIC_DNS=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicDnsName' --output text --region "$REGION")
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text --region "$REGION")

# ---- Step 5: 總結 ------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Setup 完成！"
echo "============================================================"
echo ""
echo "  Instance ID : $INSTANCE_ID"
echo "  Public IP   : $PUBLIC_IP"
echo "  Public DNS  : $PUBLIC_DNS"
echo "  App URL     : http://${PUBLIC_DNS}:${APP_PORT}"
echo "  SSH         : ssh -i ${KEY_NAME}.pem ec2-user@${PUBLIC_IP}"
echo ""
echo "  接下來：設定 GitHub Actions Secrets（Repo -> Settings -> Secrets and variables -> Actions）"
echo "    EC2_HOST                  = $PUBLIC_IP"
echo "    EC2_SSH_KEY               = (${KEY_NAME}.pem 的完整內容)"
echo "    VITE_SUPABASE_URL         = ..."
echo "    VITE_SUPABASE_ANON_KEY    = ..."
echo "    VITE_ADMIN_EMAILS         = ..."
echo "    SUPABASE_URL              = ..."
echo "    SUPABASE_SERVICE_ROLE_KEY = ..."
echo ""
echo "  然後把 cloudflare/worker/main.js 的 aws 改成： '${PUBLIC_DNS}:${APP_PORT}'"
echo "  push 到 main 後，GitHub Actions 會自動 build + 部署。"
echo ""
