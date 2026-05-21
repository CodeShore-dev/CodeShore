# =============================================================================
# setup-gcp.ps1 -- CodeShore GCP Initialization Script (PowerShell)
#
# Prerequisites:
#   1. gcloud CLI installed (https://cloud.google.com/sdk/docs/install)
#   2. gcloud auth login already done
#   3. Account has Project Creator or Owner role
#
# Usage: powershell -ExecutionPolicy Bypass -File setup-gcp.ps1
# =============================================================================

# Never "Stop" globally -- gcloud.ps1 throws PS errors on stderr,
# which would abort the script even when we just want to check exit codes.
$ErrorActionPreference = "Continue"

function Write-Info    { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[ERR]  $msg" -ForegroundColor Red; exit 1 }

# Test-Gcloud: returns $true if the gcloud command exits 0.
# All output and PS errors are suppressed -- safe for "does X exist?" checks.
function Test-Gcloud {
    param([string[]]$Arguments)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    gcloud @Arguments 2>&1 | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $old
    return $ok
}

# Invoke-Gcloud: runs a gcloud command, shows its output, aborts on failure.
function Invoke-Gcloud {
    param([string[]]$Arguments)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    gcloud @Arguments
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { Write-Err "gcloud $($Arguments -join ' ') failed (exit $code)" }
}

# Invoke-GcloudRetry: same as Invoke-Gcloud but retries on failure.
# Useful for steps that run right after API enablement -- IAM can take ~30s to propagate.
function Invoke-GcloudRetry {
    param(
        [string[]]$Arguments,
        [int]$MaxAttempts = 5,
        [int]$DelaySeconds = 15
    )
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $old = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        gcloud @Arguments
        $code = $LASTEXITCODE
        $ErrorActionPreference = $old
        if ($code -eq 0) { return }
        if ($i -lt $MaxAttempts) {
            Write-Warn "Attempt $i/$MaxAttempts failed (IAM may still be propagating). Retrying in ${DelaySeconds}s..."
            Start-Sleep -Seconds $DelaySeconds
        }
    }
    Write-Err "gcloud $($Arguments -join ' ') failed after $MaxAttempts attempts"
}

# Get-GcloudOutput: runs a gcloud command and returns its stdout as a string.
function Get-GcloudOutput {
    param([string[]]$Arguments)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    $out = (gcloud @Arguments 2>$null) | Out-String
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { Write-Err "gcloud $($Arguments -join ' ') failed (exit $code)" }
    return $out.Trim()
}

# Fixed values from cloudbuild.yaml
$REGION  = "asia-east1"
$SERVICE = "codeshore"
$AR_REPO = "cloud-run-source-deploy"

# Project root = parent of the scripts/ folder this script lives in
$SCRIPT_DIR   = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR

# =============================================================================
# Step 0: Check prerequisites
# =============================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  CodeShore -- GCP Initialization Script" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

Write-Info "Checking gcloud CLI..."
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Warn "gcloud not in PATH, searching common install locations..."

    $GCLOUD_CANDIDATES = @(
        "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin",
        "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin",
        "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin",
        "$env:USERPROFILE\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
    )

    $GCLOUD_BIN = $null
    foreach ($candidate in $GCLOUD_CANDIDATES) {
        if (Test-Path "$candidate\gcloud.cmd") {
            $GCLOUD_BIN = $candidate
            break
        }
    }

    if (-not $GCLOUD_BIN) {
        Write-Err "gcloud not found. Install from: https://cloud.google.com/sdk/docs/install"
    }

    Write-Info "Found gcloud at: $GCLOUD_BIN"
    $env:PATH = "$GCLOUD_BIN;$env:PATH"
}
Write-Success "gcloud CLI found"

Write-Info "Checking login status..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$ACTIVE_ACCOUNT = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null) | Select-Object -First 1
$ErrorActionPreference = $old
if (-not $ACTIVE_ACCOUNT) {
    Write-Err "Not logged in. Please run: gcloud auth login"
}
Write-Success "Logged in as: $ACTIVE_ACCOUNT"

# =============================================================================
# Step 1: Create or select GCP project
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 1 / 7: GCP Project" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

# Search for an existing project named "CodeShore" first.
Write-Info "Searching for existing project named 'CodeShore'..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$EXISTING_ID = (gcloud projects list --filter="name=CodeShore" --format="value(projectId)" 2>$null) |
    Select-Object -First 1
$ErrorActionPreference = $old

if ($EXISTING_ID) {
    $PROJECT_ID = $EXISTING_ID.Trim()
    Write-Success "Found existing project: $PROJECT_ID (name: CodeShore)"
} else {
    Write-Info "No project named 'CodeShore' found."
    $PROJECT_ID = Read-Host "Enter GCP Project ID (leave blank to auto-generate codeshore-XXXXXX)"
    if (-not $PROJECT_ID) {
        $chars = (48..57) + (97..122)
        $SUFFIX = -join ($chars | Get-Random -Count 6 | ForEach-Object { [char]$_ })
        $PROJECT_ID = "codeshore-$SUFFIX"
        Write-Info "Auto-generated Project ID: $PROJECT_ID"
    }

    Write-Info "Creating project $PROJECT_ID (name: CodeShore)..."
    Invoke-Gcloud @("projects", "create", $PROJECT_ID, "--name=CodeShore")
    Write-Success "Project created: $PROJECT_ID"
}

Invoke-Gcloud @("config", "set", "project", $PROJECT_ID)
Write-Success "Switched to project: $PROJECT_ID"

# =============================================================================
# Step 2: Link billing account
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 2 / 7: Billing Account" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

# Try to auto-detect billing account (requires gcloud beta component + billing permissions).
# Falls back to manual input if detection fails.
$BILLING_ACCOUNT = $null
Write-Info "Attempting to auto-detect billing account..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$billingList = (gcloud billing accounts list --filter="open=true" --format="value(name)" 2>$null)
$ErrorActionPreference = $old
if ($billingList) {
    $BILLING_ACCOUNT = ($billingList | Select-Object -First 1).Trim()
    Write-Info "Found billing account: $BILLING_ACCOUNT"
}

if (-not $BILLING_ACCOUNT) {
    Write-Warn "Could not auto-detect billing account (gcloud beta not installed or no permission)."
    Write-Host ""
    Write-Host "  To find your Billing Account ID:" -ForegroundColor Gray
    Write-Host "  GCP Console -> Billing -> select account -> look for ID like XXXXXX-XXXXXX-XXXXXX" -ForegroundColor Gray
    Write-Host "  Or run: gcloud billing accounts list" -ForegroundColor Gray
    Write-Host ""
    $BILLING_ACCOUNT = Read-Host "  Enter Billing Account ID (e.g. ABCDEF-123456-ABCDEF)"
    if (-not $BILLING_ACCOUNT) {
        Write-Err "Billing account is required. Please create one at: https://console.cloud.google.com/billing"
    }
}

# Normalize format: accept both "billingAccounts/XXXX" and bare "XXXX"
if ($BILLING_ACCOUNT -notmatch "^billingAccounts/") {
    $BILLING_ACCOUNT = "billingAccounts/$BILLING_ACCOUNT"
}
Write-Info "Using billing account: $BILLING_ACCOUNT"

$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$CURRENT_BILLING = (gcloud billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>$null) | Out-String
$ErrorActionPreference = $old
$CURRENT_BILLING = $CURRENT_BILLING.Trim()

if ($CURRENT_BILLING -eq $BILLING_ACCOUNT) {
    Write-Warn "Billing account already linked, skipping"
} else {
    Invoke-Gcloud @("billing", "projects", "link", $PROJECT_ID, "--billing-account=$BILLING_ACCOUNT")
    Write-Success "Billing account linked"
}

# =============================================================================
# Step 3: Enable required APIs
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 3 / 7: Enable GCP APIs" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

$REQUIRED_APIS = @(
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com"
)

# Check if any API is not yet enabled (so we know whether to wait after enabling).
Write-Info "Checking which APIs need to be enabled..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$enabledList = (gcloud services list --enabled --format="value(config.name)" --project=$PROJECT_ID 2>$null) -join ","
$ErrorActionPreference = $old
$needEnable = $REQUIRED_APIS | Where-Object { $enabledList -notmatch [regex]::Escape($_) }

if ($needEnable) {
    Write-Info "Enabling APIs (may take 1-2 minutes)..."
    Invoke-Gcloud @(@("services", "enable") + $REQUIRED_APIS + @("--project=$PROJECT_ID"))
    Write-Success "All APIs enabled"
    Write-Info "Waiting 30s for IAM permissions to propagate..."
    Start-Sleep -Seconds 30
} else {
    Write-Warn "All APIs already enabled, skipping wait"
}

# =============================================================================
# Step 4: Create Artifact Registry repository
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 4 / 7: Artifact Registry" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

if (Test-Gcloud @("artifacts", "repositories", "describe", $AR_REPO, "--location=$REGION", "--project=$PROJECT_ID")) {
    Write-Warn "Repository '$AR_REPO' already exists, skipping"
} else {
    Write-Info "Creating Artifact Registry repository: $AR_REPO..."
    Invoke-GcloudRetry @(
        "artifacts", "repositories", "create", $AR_REPO,
        "--repository-format=docker",
        "--location=$REGION",
        "--description=Cloud Run image repository for CodeShore",
        "--project=$PROJECT_ID"
    )
    Write-Success "Repository created: ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
}

Invoke-Gcloud @("auth", "configure-docker", "${REGION}-docker.pkg.dev", "--quiet")
Write-Success "Docker auth configured for ${REGION}-docker.pkg.dev"

# =============================================================================
# Step 5: Grant Cloud Build service account permissions
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 5 / 7: Cloud Build Permissions" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

$PROJECT_NUMBER = Get-GcloudOutput @("projects", "describe", $PROJECT_ID, "--format=value(projectNumber)")
$CB_SA      = "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
$COMPUTE_SA = "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
Write-Info "Cloud Build Service Account : $CB_SA"
Write-Info "Cloud Run (Compute) SA      : $COMPUTE_SA"

$ROLES = @(
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/artifactregistry.writer",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter"
)

# Check which roles the CB_SA already has.
Write-Info "Checking existing IAM bindings for Cloud Build SA..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$GRANTED = (gcloud projects get-iam-policy $PROJECT_ID `
    --flatten="bindings[].members" `
    "--filter=bindings.members=serviceAccount:$CB_SA" `
    --format="value(bindings.role)" 2>$null) -join ","
$ErrorActionPreference = $old

$MISSING = $ROLES | Where-Object { $GRANTED -notmatch [regex]::Escape($_) }

if (-not $MISSING) {
    Write-Warn "All Cloud Build roles already granted, skipping"
} else {
    foreach ($ROLE in $MISSING) {
        Write-Info "Granting $ROLE to Cloud Build SA..."
        Invoke-Gcloud @(
            "projects", "add-iam-policy-binding", $PROJECT_ID,
            "--member=serviceAccount:$CB_SA",
            "--role=$ROLE",
            "--quiet"
        )
    }
    Write-Success "All Cloud Build permissions granted"
}

# Cloud Run uses the Compute SA at runtime to read secrets via --set-secrets.
# Without secretAccessor, the injected env vars will be empty even if --set-secrets is set.
Write-Info "Checking secretAccessor for Cloud Run (Compute) SA..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$COMPUTE_GRANTED = (gcloud projects get-iam-policy $PROJECT_ID `
    --flatten="bindings[].members" `
    "--filter=bindings.members=serviceAccount:$COMPUTE_SA" `
    --format="value(bindings.role)" 2>$null) -join ","
$ErrorActionPreference = $old

if ($COMPUTE_GRANTED -match [regex]::Escape("roles/secretmanager.secretAccessor")) {
    Write-Warn "Compute SA already has secretAccessor, skipping"
} else {
    Write-Info "Granting roles/secretmanager.secretAccessor to Compute SA..."
    Invoke-Gcloud @(
        "projects", "add-iam-policy-binding", $PROJECT_ID,
        "--member=serviceAccount:$COMPUTE_SA",
        "--role=roles/secretmanager.secretAccessor",
        "--quiet"
    )
    Write-Success "Compute SA can now read secrets at Cloud Run runtime"
}

# =============================================================================
# Step 6: Create Secret Manager secrets
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 6 / 7: Secret Manager" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

function Set-GcpSecret {
    param(
        [string]$SecretName,
        [string]$PromptMsg
    )

    $secure = Read-Host $PromptMsg -AsSecureString
    $bstr   = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain  = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if (-not $plain) {
        Write-Warn "Skipping empty secret: $SecretName"
        return
    }

    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmpFile, $plain, [System.Text.Encoding]::UTF8)

        if (Test-Gcloud @("secrets", "describe", $SecretName, "--project=$PROJECT_ID")) {
            Write-Warn "Secret '$SecretName' exists, adding new version..."
            Invoke-Gcloud @("secrets", "versions", "add", $SecretName, "--data-file=$tmpFile", "--project=$PROJECT_ID")
        } else {
            Write-Info "Creating secret '$SecretName'..."
            Invoke-Gcloud @(
                "secrets", "create", $SecretName,
                "--data-file=$tmpFile",
                "--replication-policy=automatic",
                "--project=$PROJECT_ID"
            )
        }
        Write-Success "Secret '$SecretName' saved"
    } finally {
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "  --- Backend secrets (Supabase server-side) ---" -ForegroundColor Gray
$SKIP_SECRETS = Read-Host "  Configure Supabase backend secrets now? (Y/n)"
if ($SKIP_SECRETS -match "^[Nn]$") {
    Write-Warn "Skipping backend secrets -- Cloud Run will crash until they are set."
    Write-Host "  Set them later with:" -ForegroundColor Gray
    Write-Host "  gcloud secrets create supabase-url --data-file=- --project=$PROJECT_ID" -ForegroundColor DarkCyan
    Write-Host "  gcloud secrets create supabase-service-role-key --data-file=- --project=$PROJECT_ID" -ForegroundColor DarkCyan
} else {
    Write-Host "  Enter Supabase credentials (Supabase Dashboard -> Project Settings -> API)" -ForegroundColor Gray
    Write-Host "  Characters will not be shown while typing" -ForegroundColor Gray
    Write-Host ""
    Set-GcpSecret -SecretName "supabase-url"              -PromptMsg "  SUPABASE_URL"
    Set-GcpSecret -SecretName "supabase-service-role-key" -PromptMsg "  SUPABASE_SERVICE_ROLE_KEY"
}

# Frontend VITE_* secrets -- baked into the JS bundle at Docker build time.
# apps/frontend/.env is in .gitignore, so Cloud Build must recreate it from Secret Manager
# before running `pnpm nx build frontend`. Without these, all VITE_* vars are undefined.
Write-Host ""
Write-Host "  --- Frontend secrets (Vite build-time, baked into JS bundle) ---" -ForegroundColor Gray
$FRONTEND_ENV = "$PROJECT_ROOT\apps\frontend\.env"
if (Test-Path $FRONTEND_ENV) {
    Write-Info "Found apps/frontend/.env -- reading values from file..."
    $envLines = Get-Content $FRONTEND_ENV
    $envVals  = @{}
    foreach ($line in $envLines) {
        if ($line -match '^([^#][^=]+)=(.+)$') { $envVals[$matches[1].Trim()] = $matches[2].Trim() }
    }

    $FRONTEND_SECRETS = @{
        "vite-app-title"       = $envVals["VITE_APP_TITLE"]
        "vite-supabase-url"    = $envVals["VITE_SUPABASE_URL"]
        "vite-supabase-anon-key" = $envVals["VITE_SUPABASE_ANON_KEY"]
        "vite-admin-emails"    = $envVals["VITE_ADMIN_EMAILS"]
    }

    foreach ($entry in $FRONTEND_SECRETS.GetEnumerator()) {
        if (-not $entry.Value) { Write-Warn "  $($entry.Key): empty in .env, skipping"; continue }
        $tmpFile = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::WriteAllText($tmpFile, $entry.Value, [System.Text.Encoding]::UTF8)
            if (Test-Gcloud @("secrets", "describe", $entry.Key, "--project=$PROJECT_ID")) {
                Write-Warn "Secret '$($entry.Key)' exists, adding new version..."
                Invoke-Gcloud @("secrets", "versions", "add", $entry.Key, "--data-file=$tmpFile", "--project=$PROJECT_ID")
            } else {
                Invoke-Gcloud @("secrets", "create", $entry.Key, "--data-file=$tmpFile", "--replication-policy=automatic", "--project=$PROJECT_ID")
            }
            Write-Success "Secret '$($entry.Key)' saved"
        } finally {
            Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Warn "apps/frontend/.env not found -- enter values manually (or skip and set later)."
    Write-Host "  Characters will not be shown while typing" -ForegroundColor Gray
    Write-Host ""
    Set-GcpSecret -SecretName "vite-app-title"         -PromptMsg "  VITE_APP_TITLE"
    Set-GcpSecret -SecretName "vite-supabase-url"      -PromptMsg "  VITE_SUPABASE_URL"
    Set-GcpSecret -SecretName "vite-supabase-anon-key" -PromptMsg "  VITE_SUPABASE_ANON_KEY"
    Set-GcpSecret -SecretName "vite-admin-emails"      -PromptMsg "  VITE_ADMIN_EMAILS"
}

# =============================================================================
# Step 7: Create Cloud Build trigger (requires GitHub connection)
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 7 / 8: Cloud Build Trigger" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

Write-Host ""

# Detect GitHub connection status before asking.
Write-Info "Checking GitHub connection status..."
$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
$CONNECTIONS = (gcloud builds connections list "--project=$PROJECT_ID" "--region=$REGION" --format="value(name)" 2>$null) | Out-String
$GITHUB_TRIGGERS = (gcloud builds triggers list "--project=$PROJECT_ID" --format="value(name)" "--filter=github.name!=''" 2>$null) | Out-String
$ErrorActionPreference = $old

if ($CONNECTIONS.Trim() -or $GITHUB_TRIGGERS.Trim()) {
    Write-Success "GitHub connection detected"
    if ($CONNECTIONS.Trim()) { Write-Host "  Connections : $($CONNECTIONS.Trim())" -ForegroundColor Gray }
    if ($GITHUB_TRIGGERS.Trim()) { Write-Host "  Triggers    : $($GITHUB_TRIGGERS.Trim())" -ForegroundColor Gray }
} else {
    Write-Warn "No GitHub connection found."
    Write-Host ""
    Write-Host "  Complete this in GCP Console first:" -ForegroundColor Yellow
    Write-Host "  Cloud Build -> Triggers -> Connect Repository -> GitHub" -ForegroundColor Gray
    Write-Host "  Install Cloud Build GitHub App -> select your repository" -ForegroundColor Gray
    Write-Host ""
}

$CREATE_TRIGGER = Read-Host "  Create trigger now? (y/N)"

if ($CREATE_TRIGGER -match "^[Yy]$") {
    $GITHUB_OWNER   = Read-Host "  GitHub username or org"
    $GITHUB_REPO    = Read-Host "  GitHub repository name (e.g. CodeShore)"
    $TRIGGER_BRANCH = Read-Host "  Branch to trigger on (default: main)"
    if (-not $TRIGGER_BRANCH) { $TRIGGER_BRANCH = "main" }

    $TRIGGER_NAME = "${SERVICE}-deploy"

    if (Test-Gcloud @("builds", "triggers", "describe", $TRIGGER_NAME, "--project=$PROJECT_ID")) {
        Write-Warn "Trigger '$TRIGGER_NAME' already exists, skipping"
    } else {
        Write-Info "Creating Cloud Build trigger: $TRIGGER_NAME..."
        $old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
        gcloud builds triggers create github `
            "--name=""$TRIGGER_NAME""" `
            "--repo-owner=""$GITHUB_OWNER""" `
            "--repo-name=""$GITHUB_REPO""" `
            "--branch-pattern=^${TRIGGER_BRANCH}$" `
            --build-config=cloudbuild.yaml `
            "--project=$PROJECT_ID"
        $triggerCode = $LASTEXITCODE
        $ErrorActionPreference = $old

        if ($triggerCode -eq 0) {
            Write-Success "Trigger created: push to $TRIGGER_BRANCH will auto-deploy"
        } else {
            Write-Warn "CLI trigger creation failed (GitHub App may not be connected yet)."
            Write-Host ""
            Write-Host "  Complete GitHub connection in GCP Console first:" -ForegroundColor Yellow
            Write-Host "  GCP Console -> Cloud Build -> Triggers -> Connect Repository" -ForegroundColor Gray
            Write-Host "  -> Authorize GitHub App -> select $GITHUB_OWNER/$GITHUB_REPO" -ForegroundColor Gray
            Write-Host ""
            Write-Host "  Then create the trigger manually:" -ForegroundColor Yellow
            Write-Host "     gcloud builds triggers create github ``" -ForegroundColor DarkCyan
            Write-Host "       --name=$TRIGGER_NAME ``" -ForegroundColor DarkCyan
            Write-Host "       --repo-owner=$GITHUB_OWNER ``" -ForegroundColor DarkCyan
            Write-Host "       --repo-name=$GITHUB_REPO ``" -ForegroundColor DarkCyan
            Write-Host "       --branch-pattern='^${TRIGGER_BRANCH}$' ``" -ForegroundColor DarkCyan
            Write-Host "       --build-config=cloudbuild.yaml ``" -ForegroundColor DarkCyan
            Write-Host "       --project=$PROJECT_ID" -ForegroundColor DarkCyan
            Write-Host ""
        }
    }
} else {
    Write-Warn "Skipping trigger creation"
    Write-Host ""
    Write-Host "  To create it manually later:" -ForegroundColor Gray
    Write-Host "  1. GCP Console -> Cloud Build -> Triggers -> Connect Repository" -ForegroundColor Gray
    Write-Host "  2. Authorize GitHub and select your repo, then run:" -ForegroundColor Gray
    Write-Host ""
    Write-Host "     gcloud builds triggers create github ``" -ForegroundColor DarkCyan
    Write-Host "       --name=${SERVICE}-deploy ``" -ForegroundColor DarkCyan
    Write-Host "       --repo-owner=<OWNER> ``" -ForegroundColor DarkCyan
    Write-Host "       --repo-name=<REPO> ``" -ForegroundColor DarkCyan
    Write-Host "       --branch-pattern='^main$' ``" -ForegroundColor DarkCyan
    Write-Host "       --build-config=cloudbuild.yaml ``" -ForegroundColor DarkCyan
    Write-Host "       --project=$PROJECT_ID" -ForegroundColor DarkCyan
    Write-Host ""
}

# =============================================================================
# Step 8: Build & Deploy to Cloud Run
# =============================================================================
Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Step 8 / 8: Build & Deploy to Cloud Run" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

Write-Host ""
Write-Host "  Running Cloud Build -- this streams build logs and may take 10-15 minutes." -ForegroundColor Gray
Write-Host ""

$old = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
gcloud builds submit `
    "--config=$PROJECT_ROOT\cloudbuild.yaml" `
    "--project=$PROJECT_ID" `
    $PROJECT_ROOT
$buildCode = $LASTEXITCODE
$ErrorActionPreference = $old

if ($buildCode -eq 0) {
    $SERVICE_URL = (gcloud run services describe $SERVICE `
        "--region=$REGION" "--project=$PROJECT_ID" `
        --format="value(status.url)" 2>$null) | Out-String
    $SERVICE_URL = $SERVICE_URL.Trim()
    Write-Host ""
    Write-Success "App is live!"
    if ($SERVICE_URL) {
        Write-Host "  URL: $SERVICE_URL" -ForegroundColor Green
    }
} else {
    Write-Warn "Cloud Build failed. Check logs:"
    Write-Host "  gcloud builds list --project=$PROJECT_ID --limit=5" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "  To retry the build manually:" -ForegroundColor Gray
    Write-Host "  gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID ." -ForegroundColor DarkCyan
}

# =============================================================================
# Summary
# =============================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Project ID        : $PROJECT_ID"
Write-Host "  Region            : $REGION"
Write-Host "  Cloud Run service : $SERVICE"
Write-Host "  Artifact Registry : ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}"
Write-Host "  Cloud Build SA    : $CB_SA"
Write-Host "  Cloud Run SA      : $COMPUTE_SA"
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify secrets:"
Write-Host "     gcloud secrets versions access latest --secret=supabase-url --project=$PROJECT_ID"
Write-Host ""
Write-Host "  2. Trigger first build manually:"
Write-Host "     gcloud builds submit --config=cloudbuild.yaml --project=$PROJECT_ID ."
Write-Host ""
Write-Host "  3. Get Cloud Run service URL after deploy:"
Write-Host "     gcloud run services describe $SERVICE --region=$REGION --project=$PROJECT_ID --format='value(status.url)'"
Write-Host ""
