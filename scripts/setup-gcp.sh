#!/usr/bin/env bash
# =============================================================================
# setup-gcp.sh -- CodeShore GCP Initialization Script (Bash)
#
# Prerequisites:
#   1. gcloud CLI installed (https://cloud.google.com/sdk/docs/install)
#   2. gcloud auth login already done
#   3. Account has Project Creator or Owner role
#
# Usage: bash setup-gcp.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; exit 1; }

# gcloud_retry: run a gcloud command, retry on failure.
# Useful for steps right after API enablement -- IAM takes ~30s to propagate.
gcloud_retry() {
  local max=5 delay=15 attempt=1
  until gcloud "$@"; do
    if (( attempt >= max )); then
      error "gcloud $* failed after $max attempts"
    fi
    warn "Attempt $attempt/$max failed (IAM may still be propagating). Retrying in ${delay}s..."
    sleep "$delay"
    (( attempt++ ))
  done
}

# Fixed values from cloudbuild.yaml
REGION="asia-east1"
SERVICE="codeshore"
AR_REPO="cloud-run-source-deploy"

# Project root = parent of the scripts/ folder this script lives in
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# =============================================================================
# Step 0: Check prerequisites
# =============================================================================
echo ""
echo "============================================================"
echo "  CodeShore -- GCP Initialization Script"
echo "============================================================"
echo ""

info "Checking gcloud CLI..."
if ! command -v gcloud &>/dev/null; then
  warn "gcloud not in PATH, searching common install locations..."

  GCLOUD_CANDIDATES=(
    "$HOME/google-cloud-sdk/bin"
    "$HOME/.local/share/google-cloud-sdk/bin"
    "/usr/lib/google-cloud-sdk/bin"
    "/usr/local/lib/google-cloud-sdk/bin"
    "/opt/google-cloud-sdk/bin"
    "/snap/bin"
    # Git Bash on Windows
    "${LOCALAPPDATA:-}/Google/Cloud SDK/google-cloud-sdk/bin"
    "${USERPROFILE:-}/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
  )

  GCLOUD_BIN=""
  for candidate in "${GCLOUD_CANDIDATES[@]}"; do
    if [[ -x "$candidate/gcloud" ]] || [[ -f "$candidate/gcloud.cmd" ]]; then
      GCLOUD_BIN="$candidate"
      break
    fi
  done

  [[ -z "$GCLOUD_BIN" ]] && error "gcloud not found. Install from: https://cloud.google.com/sdk/docs/install"
  info "Found gcloud at: $GCLOUD_BIN"
  export PATH="$GCLOUD_BIN:$PATH"
fi
success "gcloud CLI found"

info "Checking login status..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n1)
[[ -z "$ACTIVE_ACCOUNT" ]] && error "Not logged in. Please run: gcloud auth login"
success "Logged in as: $ACTIVE_ACCOUNT"

# =============================================================================
# Step 1: Create or select GCP project
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 1 / 7: GCP Project"
echo "------------------------------------------------------------"

# Search for an existing project named "CodeShore" first.
info "Searching for existing project named 'CodeShore'..."
EXISTING_ID=$(gcloud projects list --filter="name=CodeShore" --format="value(projectId)" 2>/dev/null | head -n1 || true)

if [[ -n "$EXISTING_ID" ]]; then
  PROJECT_ID="$EXISTING_ID"
  success "Found existing project: $PROJECT_ID (name: CodeShore)"
else
  info "No project named 'CodeShore' found."
  read -rp "Enter GCP Project ID (leave blank to auto-generate codeshore-XXXXXX): " PROJECT_ID
  if [[ -z "$PROJECT_ID" ]]; then
    SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c6)
    PROJECT_ID="codeshore-${SUFFIX}"
    info "Auto-generated Project ID: $PROJECT_ID"
  fi

  info "Creating project $PROJECT_ID (name: CodeShore)..."
  gcloud projects create "$PROJECT_ID" --name="CodeShore"
  success "Project created: $PROJECT_ID"
fi

gcloud config set project "$PROJECT_ID"
success "Switched to project: $PROJECT_ID"

# =============================================================================
# Step 2: Link billing account
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 2 / 7: Billing Account"
echo "------------------------------------------------------------"

# Try auto-detect with gcloud billing (GA, no beta component needed).
info "Attempting to auto-detect billing account..."
BILLING_ACCOUNT=$(gcloud billing accounts list --filter="open=true" --format="value(name)" 2>/dev/null | head -n1 || true)

if [[ -z "$BILLING_ACCOUNT" ]]; then
  warn "Could not auto-detect billing account (no permission or no accounts found)."
  echo ""
  echo "  To find your Billing Account ID:"
  echo "  GCP Console -> Billing -> select account -> ID looks like XXXXXX-XXXXXX-XXXXXX"
  echo "  Or run: gcloud billing accounts list"
  echo ""
  read -rp "  Enter Billing Account ID (e.g. ABCDEF-123456-ABCDEF): " BILLING_ACCOUNT
  [[ -z "$BILLING_ACCOUNT" ]] && error "Billing account is required. Create one at: https://console.cloud.google.com/billing"
fi

# Normalize: accept both "billingAccounts/XXXX" and bare "XXXX"
[[ "$BILLING_ACCOUNT" != billingAccounts/* ]] && BILLING_ACCOUNT="billingAccounts/$BILLING_ACCOUNT"
info "Using billing account: $BILLING_ACCOUNT"

CURRENT_BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" 2>/dev/null || true)
if [[ "$CURRENT_BILLING" == "$BILLING_ACCOUNT" ]]; then
  warn "Billing account already linked, skipping"
else
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
  success "Billing account linked"
fi

# =============================================================================
# Step 3: Enable required APIs
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 3 / 7: Enable GCP APIs"
echo "------------------------------------------------------------"

REQUIRED_APIS=(
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "artifactregistry.googleapis.com"
  "secretmanager.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "iam.googleapis.com"
)

# Check if any API is not yet enabled.
info "Checking which APIs need to be enabled..."
ENABLED_LIST=$(gcloud services list --enabled --format="value(config.name)" --project="$PROJECT_ID" 2>/dev/null || true)
NEED_ENABLE=false
for api in "${REQUIRED_APIS[@]}"; do
  if ! echo "$ENABLED_LIST" | grep -qx "$api"; then
    NEED_ENABLE=true
    break
  fi
done

if [[ "$NEED_ENABLE" == "true" ]]; then
  info "Enabling APIs (may take 1-2 minutes)..."
  gcloud services enable "${REQUIRED_APIS[@]}" --project="$PROJECT_ID"
  success "All APIs enabled"
  info "Waiting 30s for IAM permissions to propagate..."
  sleep 30
else
  warn "All APIs already enabled, skipping wait"
fi

# =============================================================================
# Step 4: Create Artifact Registry repository
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 4 / 7: Artifact Registry"
echo "------------------------------------------------------------"

if gcloud artifacts repositories describe "$AR_REPO" \
     --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  warn "Repository '$AR_REPO' already exists, skipping"
else
  info "Creating Artifact Registry repository: $AR_REPO..."
  gcloud_retry artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Cloud Run image repository for CodeShore" \
    --project="$PROJECT_ID"
  success "Repository created: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
fi

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
success "Docker auth configured for ${REGION}-docker.pkg.dev"

# =============================================================================
# Step 5: Grant Cloud Build service account permissions
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 5 / 7: Cloud Build Permissions"
echo "------------------------------------------------------------"

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
info "Cloud Build Service Account : $CB_SA"
info "Cloud Run (Compute) SA      : $COMPUTE_SA"

ROLES=(
  "roles/run.admin"
  "roles/iam.serviceAccountUser"
  "roles/artifactregistry.writer"
  "roles/secretmanager.secretAccessor"
  "roles/logging.logWriter"
)

# Check which roles the CB_SA already has.
info "Checking existing IAM bindings for Cloud Build SA..."
GRANTED=$(gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.members=serviceAccount:$CB_SA" \
  --format="value(bindings.role)" 2>/dev/null || true)

ALL_GRANTED=true
for ROLE in "${ROLES[@]}"; do
  if ! echo "$GRANTED" | grep -qx "$ROLE"; then
    ALL_GRANTED=false
    break
  fi
done

if [[ "$ALL_GRANTED" == "true" ]]; then
  warn "All Cloud Build roles already granted, skipping"
else
  for ROLE in "${ROLES[@]}"; do
    if ! echo "$GRANTED" | grep -qx "$ROLE"; then
      info "Granting $ROLE to Cloud Build SA..."
      gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$CB_SA" \
        --role="$ROLE" \
        --quiet
    fi
  done
  success "All Cloud Build permissions granted"
fi

# Cloud Run uses the Compute SA at runtime to read secrets via --set-secrets.
# Without secretAccessor, the injected env vars will be empty even if --set-secrets is set.
info "Checking secretAccessor for Cloud Run (Compute) SA..."
COMPUTE_GRANTED=$(gcloud projects get-iam-policy "$PROJECT_ID" \
  --flatten="bindings[].members" \
  --filter="bindings.members=serviceAccount:$COMPUTE_SA" \
  --format="value(bindings.role)" 2>/dev/null || true)

if echo "$COMPUTE_GRANTED" | grep -qx "roles/secretmanager.secretAccessor"; then
  warn "Compute SA already has secretAccessor, skipping"
else
  info "Granting roles/secretmanager.secretAccessor to Compute SA..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet
  success "Compute SA can now read secrets at Cloud Run runtime"
fi

# =============================================================================
# Step 6: Create Secret Manager secrets
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 6 / 7: Secret Manager"
echo "------------------------------------------------------------"

create_or_update_secret() {
  local SECRET_NAME="$1"
  local PROMPT_MSG="$2"

  read -rsp "$PROMPT_MSG: " SECRET_VALUE
  echo ""
  if [[ -z "$SECRET_VALUE" ]]; then
    warn "Skipping empty secret: $SECRET_NAME"
    return
  fi

  if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
    warn "Secret '$SECRET_NAME' exists, adding new version..."
    echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
      --data-file=- --project="$PROJECT_ID"
  else
    info "Creating secret '$SECRET_NAME'..."
    echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
      --data-file=- \
      --replication-policy=automatic \
      --project="$PROJECT_ID"
  fi
  success "Secret '$SECRET_NAME' saved"
}

echo ""
echo "  --- Backend secrets (Supabase server-side) ---"
read -rp "  Configure Supabase backend secrets now? (Y/n): " SKIP_SECRETS
if [[ "$SKIP_SECRETS" =~ ^[Nn]$ ]]; then
  warn "Skipping backend secrets -- Cloud Run will crash until they are set."
  echo "  Set them later with:"
  echo "  gcloud secrets create supabase-url --data-file=- --project=$PROJECT_ID"
  echo "  gcloud secrets create supabase-service-role-key --data-file=- --project=$PROJECT_ID"
else
  echo "  Enter Supabase credentials (Supabase Dashboard -> Project Settings -> API)"
  echo "  Characters will not be shown while typing"
  echo ""
  create_or_update_secret "supabase-url"              "  SUPABASE_URL"
  create_or_update_secret "supabase-service-role-key" "  SUPABASE_SERVICE_ROLE_KEY"
fi

# Frontend VITE_* secrets -- baked into the JS bundle at Docker build time.
# apps/frontend/.env is in .gitignore, so Cloud Build must recreate it from Secret Manager
# before running `pnpm nx build frontend`. Without these, all VITE_* vars are undefined.
echo ""
echo "  --- Frontend secrets (Vite build-time, baked into JS bundle) ---"
FRONTEND_ENV="$PROJECT_ROOT/apps/frontend/.env"

save_frontend_secret() {
  local SECRET_NAME="$1" VALUE="$2"
  if [[ -z "$VALUE" ]]; then warn "  $SECRET_NAME: empty, skipping"; return; fi
  if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
    warn "Secret '$SECRET_NAME' exists, adding new version..."
    echo -n "$VALUE" | gcloud secrets versions add "$SECRET_NAME" \
      --data-file=- --project="$PROJECT_ID"
  else
    echo -n "$VALUE" | gcloud secrets create "$SECRET_NAME" \
      --data-file=- --replication-policy=automatic --project="$PROJECT_ID"
  fi
  success "Secret '$SECRET_NAME' saved"
}

if [[ -f "$FRONTEND_ENV" ]]; then
  info "Found apps/frontend/.env -- reading values from file..."
  # Parse key=value lines (skip comments and blanks)
  declare -A ENV_VALS
  while IFS='=' read -r key val; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    ENV_VALS["$key"]="$val"
  done < <(grep -v '^#' "$FRONTEND_ENV" | grep '=')

  save_frontend_secret "vite-app-title"         "${ENV_VALS[VITE_APP_TITLE]:-}"
  save_frontend_secret "vite-supabase-url"       "${ENV_VALS[VITE_SUPABASE_URL]:-}"
  save_frontend_secret "vite-supabase-anon-key"  "${ENV_VALS[VITE_SUPABASE_ANON_KEY]:-}"
  save_frontend_secret "vite-admin-emails"       "${ENV_VALS[VITE_ADMIN_EMAILS]:-}"
else
  warn "apps/frontend/.env not found -- enter values manually (or skip and set later)."
  echo "  Characters will not be shown while typing"
  echo ""
  create_or_update_secret "vite-app-title"         "  VITE_APP_TITLE"
  create_or_update_secret "vite-supabase-url"      "  VITE_SUPABASE_URL"
  create_or_update_secret "vite-supabase-anon-key" "  VITE_SUPABASE_ANON_KEY"
  create_or_update_secret "vite-admin-emails"      "  VITE_ADMIN_EMAILS"
fi

# =============================================================================
# Step 7: Create Cloud Build trigger (requires GitHub connection)
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 7 / 8: Cloud Build Trigger"
echo "------------------------------------------------------------"

echo ""

# Detect GitHub connection status before asking.
info "Checking GitHub connection status..."
CONNECTIONS=$(gcloud builds connections list \
  --project="$PROJECT_ID" --region="$REGION" \
  --format="value(name)" 2>/dev/null || true)
GITHUB_TRIGGERS=$(gcloud builds triggers list \
  --project="$PROJECT_ID" \
  --format="value(name)" \
  --filter="github.name!=''" 2>/dev/null || true)

if [[ -n "$CONNECTIONS" || -n "$GITHUB_TRIGGERS" ]]; then
  success "GitHub connection detected"
  [[ -n "$CONNECTIONS" ]]      && echo "  Connections : $CONNECTIONS"
  [[ -n "$GITHUB_TRIGGERS" ]]  && echo "  Triggers    : $GITHUB_TRIGGERS"
else
  warn "No GitHub connection found."
  echo ""
  echo "  Complete this in GCP Console first:"
  echo "  Cloud Build -> Triggers -> Connect Repository -> GitHub"
  echo "  Install Cloud Build GitHub App -> select your repository"
  echo ""
fi

read -rp "  Create trigger now? (y/N): " CREATE_TRIGGER

if [[ "$CREATE_TRIGGER" =~ ^[Yy]$ ]]; then
  read -rp "  GitHub username or org: " GITHUB_OWNER
  read -rp "  GitHub repository name (e.g. CodeShore): " GITHUB_REPO
  read -rp "  Branch to trigger on (default: main): " TRIGGER_BRANCH
  TRIGGER_BRANCH="${TRIGGER_BRANCH:-main}"

  TRIGGER_NAME="${SERVICE}-deploy"

  if gcloud builds triggers describe "$TRIGGER_NAME" --project="$PROJECT_ID" &>/dev/null; then
    warn "Trigger '$TRIGGER_NAME' already exists, skipping"
  else
    info "Creating Cloud Build trigger: $TRIGGER_NAME..."
    if gcloud builds triggers create github \
         --name="""$TRIGGER_NAME""" \
         --repo-owner="""$GITHUB_OWNER""" \
         --repo-name="""$GITHUB_REPO""" \
         --branch-pattern="^${TRIGGER_BRANCH}$" \
         --build-config="cloudbuild.yaml" \
         --project="$PROJECT_ID" 2>/dev/null; then
      success "Trigger created: push to $TRIGGER_BRANCH will auto-deploy"
    else
      warn "CLI trigger creation failed (GitHub App may not be connected yet)."
      echo ""
      echo "  Complete GitHub connection in GCP Console first:"
      echo "  GCP Console -> Cloud Build -> Triggers -> Connect Repository"
      echo "  -> Authorize GitHub App -> select $GITHUB_OWNER/$GITHUB_REPO"
      echo ""
      echo "  Then create the trigger manually:"
      cat <<EOF
     gcloud builds triggers create github \\
       --name=$TRIGGER_NAME \\
       --repo-owner=$GITHUB_OWNER \\
       --repo-name=$GITHUB_REPO \\
       --branch-pattern="^${TRIGGER_BRANCH}\$" \\
       --build-config=cloudbuild.yaml \\
       --project=$PROJECT_ID
EOF
      echo ""
    fi
  fi
else
  warn "Skipping trigger creation"
  echo ""
  echo "  To create it manually later:"
  echo "  1. GCP Console -> Cloud Build -> Triggers -> Connect Repository"
  echo "  2. Authorize GitHub and select your repo, then run:"
  echo ""
  cat <<EOF
     gcloud builds triggers create github \\
       --name=${SERVICE}-deploy \\
       --repo-owner=<OWNER> \\
       --repo-name=<REPO> \\
       --branch-pattern="^main\$" \\
       --build-config=cloudbuild.yaml \\
       --project=$PROJECT_ID
EOF
  echo ""
fi

# =============================================================================
# Step 8: Build & Deploy to Cloud Run
# =============================================================================
echo ""
echo "------------------------------------------------------------"
echo "  Step 8 / 8: Build & Deploy to Cloud Run"
echo "------------------------------------------------------------"
echo ""
echo "  Running Cloud Build -- this streams build logs and may take 10-15 minutes."
echo ""

if gcloud builds submit \
     --config="$PROJECT_ROOT/cloudbuild.yaml" \
     --project="$PROJECT_ID" \
     "$PROJECT_ROOT"; then
  SERVICE_URL=$(gcloud run services describe "$SERVICE" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null || true)
  echo ""
  success "App is live!"
  [[ -n "$SERVICE_URL" ]] && echo "  URL: $SERVICE_URL"
else
  warn "Cloud Build failed. Check logs:"
  echo "  gcloud builds list --project=$PROJECT_ID --limit=5"
  echo ""
  echo "  To retry the build manually:"
  echo "  gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID ."
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================"
echo "  Setup complete!"
echo "============================================================"
echo ""
echo "  Project ID        : $PROJECT_ID"
echo "  Region            : $REGION"
echo "  Cloud Run service : $SERVICE"
echo "  Artifact Registry : ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
echo "  Cloud Build SA    : $CB_SA"
echo "  Cloud Run SA      : $COMPUTE_SA"
echo ""
echo "  Next steps:"
echo "  1. Verify secrets:"
echo "     gcloud secrets versions access latest --secret=supabase-url --project=$PROJECT_ID"
echo ""
echo "  2. Trigger first build manually:"
echo "     gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID ."
echo ""
echo "  3. Get Cloud Run service URL after deploy:"
echo "     gcloud run services describe $SERVICE --region=$REGION --project=$PROJECT_ID --format='value(status.url)'"
echo ""
