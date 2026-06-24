#!/usr/bin/env bash
# =============================================================================
# setup-aws-s3-cloudfront.sh -- CodeShore 前端 S3 + CloudFront 初始化
#
# 把前端靜態檔放到 S3，前面用 CloudFront 當 CDN/HTTPS 入口，並把：
#   - 預設路徑   -> S3（前端 SPA）
#   - /api/*     -> Lambda Function URL（後端，純 API）
# 前端在生產環境用 window.location.origin 打 /api，因此同源、無 CORS、前端零改動。
#
# 前置：先跑過 setup-aws-lambda.sh 並至少部署過一次 Lambda（才有 Function URL）。
# Prerequisites: AWS CLI v2 + aws configure
# Usage:
#   bash scripts/setup-aws-s3-cloudfront.sh                 # 自動抓 Lambda Function URL
#   API_ORIGIN=xxxx.lambda-url.ap-northeast-1.on.aws bash scripts/setup-aws-s3-cloudfront.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

REGION="${AWS_REGION:-ap-northeast-1}"
FUNCTION_NAME="${FUNCTION_NAME:-codeshore}"
NAME="codeshore"

# CloudFront 受管政策 ID（全 AWS 帳號通用的固定值）
CACHE_OPTIMIZED="658327ea-f89d-4fab-a63d-7e88639e58f6"   # 給 S3 靜態
CACHE_DISABLED="4135ea2d-6df8-44a3-9df3-4b5a84be39ad"    # 給 /api（不快取）
ORP_ALLVIEWER_NOHOST="b689b0a8-53d0-40ab-baf2-68738e2966ac"  # 轉發全部但不含 Host（Function URL 需要）

echo ""
echo "============================================================"
echo "  CodeShore -- S3 + CloudFront Initialization"
echo "============================================================"
echo "  Region : $REGION"
echo ""

command -v aws &>/dev/null || error "找不到 aws CLI"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) \
  || error "AWS 未登入，請先 aws configure"
success "AWS 帳號: $ACCOUNT_ID"

BUCKET="${NAME}-frontend-${ACCOUNT_ID}"

# ---- Step 0: 取得後端 API origin（Lambda Function URL host）-------------------
if [[ -z "${API_ORIGIN:-}" ]]; then
  info "從 Lambda function '$FUNCTION_NAME' 抓取 Function URL ..."
  FN_URL=$(aws lambda get-function-url-config --function-name "$FUNCTION_NAME" \
    --region "$REGION" --query FunctionUrl --output text 2>/dev/null || true)
  [[ -z "$FN_URL" || "$FN_URL" == "None" ]] && \
    error "找不到 Function URL。請先部署 Lambda（deploy-aws-lambda.yml），或用 API_ORIGIN=... 指定後端網域"
  API_ORIGIN=$(echo "$FN_URL" | sed -E 's#^https?://##; s#/$##')
fi
success "後端 API origin: $API_ORIGIN"

# ---- Step 1: S3 bucket（私有，僅 CloudFront 可讀）-----------------------------
echo ""
echo "  Step 1 / 4: S3 bucket"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  warn "Bucket '$BUCKET' 已存在，沿用"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true >/dev/null
  success "Bucket 建立完成: $BUCKET（私有）"
fi

# ---- Step 2: Origin Access Control（讓 CloudFront 讀私有 S3）------------------
echo ""
echo "  Step 2 / 4: Origin Access Control"
OAC_ID=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${NAME}-oac'].Id | [0]" --output text 2>/dev/null || true)
if [[ -z "$OAC_ID" || "$OAC_ID" == "None" ]]; then
  OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
    "Name=${NAME}-oac,Description=CodeShore S3 OAC,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query 'OriginAccessControl.Id' --output text)
  success "OAC 建立完成: $OAC_ID"
else
  warn "OAC 已存在: $OAC_ID"
fi

# ---- Step 3: CloudFront distribution -----------------------------------------
echo ""
echo "  Step 3 / 4: CloudFront distribution"
S3_DOMAIN="${BUCKET}.s3.${REGION}.amazonaws.com"
CALLER_REF="${NAME}-$(date +%s)"

EXISTING_DIST=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?DomainName=='${S3_DOMAIN}']].Id | [0]" \
  --output text 2>/dev/null || true)

if [[ -n "$EXISTING_DIST" && "$EXISTING_DIST" != "None" ]]; then
  warn "已存在指向此 bucket 的 distribution: $EXISTING_DIST，跳過建立"
  DIST_ID="$EXISTING_DIST"
else
  CONFIG=$(mktemp)
  cat > "$CONFIG" <<JSON
{
  "CallerReference": "${CALLER_REF}",
  "Comment": "CodeShore frontend (S3) + /api -> Lambda",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 2,
    "Items": [
      {
        "Id": "s3-frontend",
        "DomainName": "${S3_DOMAIN}",
        "OriginAccessControlId": "${OAC_ID}",
        "S3OriginConfig": { "OriginAccessIdentity": "" }
      },
      {
        "Id": "lambda-api",
        "DomainName": "${API_ORIGIN}",
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "https-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] }
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "${CACHE_OPTIMIZED}",
    "Compress": true,
    "AllowedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "/api/*",
        "TargetOriginId": "lambda-api",
        "ViewerProtocolPolicy": "redirect-to-https",
        "CachePolicyId": "${CACHE_DISABLED}",
        "OriginRequestPolicyId": "${ORP_ALLVIEWER_NOHOST}",
        "Compress": true,
        "AllowedMethods": {
          "Quantity": 7,
          "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"]
        }
      }
    ]
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      { "ErrorCode": 403, "ResponseCode": "200", "ResponsePagePath": "/index.html", "ErrorCachingMinTTL": 10 },
      { "ErrorCode": 404, "ResponseCode": "200", "ResponsePagePath": "/index.html", "ErrorCachingMinTTL": 10 }
    ]
  },
  "PriceClass": "PriceClass_200"
}
JSON
  DIST_ID=$(aws cloudfront create-distribution --distribution-config "file://$CONFIG" \
    --query 'Distribution.Id' --output text)
  rm -f "$CONFIG"
  success "CloudFront distribution 建立完成: $DIST_ID（部署需 5-15 分鐘）"
fi

DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" \
  --query 'Distribution.DomainName' --output text)
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

# ---- Step 4: S3 bucket policy（只允許這個 distribution 透過 OAC 讀）-----------
echo ""
echo "  Step 4 / 4: S3 bucket policy"
POLICY=$(mktemp)
cat > "$POLICY" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/*",
    "Condition": { "StringEquals": { "AWS:SourceArn": "${DIST_ARN}" } }
  }]
}
JSON
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "file://$POLICY"
rm -f "$POLICY"
success "Bucket policy 設定完成（僅此 CloudFront 可讀）"

# ---- 總結 --------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  S3 + CloudFront 完成！"
echo "============================================================"
echo ""
echo "  S3 bucket           : $BUCKET"
echo "  CloudFront dist id  : $DIST_ID"
echo "  CloudFront 網址     : https://${DIST_DOMAIN}"
echo "  /api -> 後端        : $API_ORIGIN"
echo ""
echo "  接下來：設定 GitHub Actions Secrets（給前端部署 workflow 用）"
echo "    S3_BUCKET                   = $BUCKET"
echo "    CLOUDFRONT_DISTRIBUTION_ID  = $DIST_ID"
echo "  （AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION 與 Lambda 共用）"
echo ""
echo "  然後 push 到 main，deploy-aws-frontend.yml 會 build 前端 -> sync S3 -> 刷 CloudFront 快取。"
echo "  最後把 cloudflare/worker/main.js 的 aws 改成： 'https://${DIST_DOMAIN}'"
echo ""
