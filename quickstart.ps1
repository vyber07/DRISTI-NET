<#
.SYNOPSIS
    DRISTI-NET — Windows PowerShell Universal Quickstart & Deployment Script
.DESCRIPTION
    Audits Windows hardware (CPU, RAM, Disk), discovers network interfaces (Localhost, LAN, WAN),
    checks toolchain prerequisites, asks for host binding permission (127.0.0.1 vs 0.0.0.0),
    asks for demo seeding confirmation, starts the Docker Compose stack, applies migrations,
    and opens the default web browser.
.EXAMPLE
    irm https://raw.githubusercontent.com/vyber07/DRISTI-NET/main/quickstart.ps1 | iex
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\quickstart.ps1 -Bind 0.0.0.0 -Seed
#>

[CmdletBinding()]
param (
    [string]$Bind = "",
    [switch]$Public,
    [switch]$Local,
    [switch]$Seed,
    [switch]$NoSeed,
    [switch]$NoBrowser,
    [switch]$Pull,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-InfoMsg {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor DarkCyan
}

Write-Host @"
  ____  ____  ___ ____ _____ ___     _   _ _____ _____ 
 |  _ \|  _ \|_ _/ ___|_   _|_ _|   | \ | | ____|_   _|
 | | | | |_) || |\___ \ | |  | |____|  \| |  _|   | |  
 | |_| |  _ < | | ___) || |  | |____| |\  | |___  | |  
 |____/|_| \_\___|____/ |_| |___|   |_| \_|_____| |_|  
 Digital Record & Intelligence Synthesizer for Transparent Investigations
"@ -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. HARDWARE & SYSTEM SPECIFICATION AUDIT
# -----------------------------------------------------------------------------
Write-Step "Step 1: Inspecting System Specifications & Hardware Requirements"

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum

$osName = $os.Caption
$cpuCores = $cpu.Sum
$totalRamGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)

Write-InfoMsg "Operating System: $osName"
if ($cpuCores -lt 2) {
    Write-WarnMsg "CPU Cores: $cpuCores detected. Recommended >= 2 cores."
} else {
    Write-Success "CPU Cores: $cpuCores (Requirement satisfied: >= 2 cores)"
}

if ($totalRamGB -lt 4.0) {
    Write-WarnMsg "Total RAM: $totalRamGB GB detected. DRISTI-NET multi-service stack recommends >= 4.0 GB."
} else {
    Write-Success "Total RAM: $totalRamGB GB (Requirement satisfied: >= 4 GB)"
}

$systemDrive = Get-PSDrive -Name C -ErrorAction SilentlyContinue
if ($systemDrive) {
    $freeDiskGB = [math]::Round($systemDrive.Free / 1GB, 2)
    if ($freeDiskGB -lt 5.0) {
        Write-WarnMsg "Free Disk Space: $freeDiskGB GB. Recommended >= 10.0 GB for Docker images and volumes."
    } else {
        Write-Success "Free Disk Space: $freeDiskGB GB (Requirement satisfied: >= 5 GB free)"
    }
}

# -----------------------------------------------------------------------------
# 2. NETWORK & IP DETAILS DISCOVERY & BINDING SELECTION
# -----------------------------------------------------------------------------
Write-Step "Step 2: Probing Network Interfaces & Host IP Details"

# 1. Localhost
$loopbackIp = "127.0.0.1"
Write-InfoMsg "Localhost Loopback: $loopbackIp"

# 2. LAN IP
$lanIp = ""
try {
    $netAdapters = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                   Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\.254\." }
    if ($netAdapters) {
        $lanIp = ($netAdapters | Select-Object -First 1).IPAddress
        Write-Success "Local Network (LAN) IP: $lanIp"
    }
} catch {
    # Fallback to WMI
    try {
        $wmiNet = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true }
        if ($wmiNet -and $wmiNet.IPAddress) {
            $lanIp = $wmiNet.IPAddress[0]
            Write-Success "Local Network (LAN) IP: $lanIp"
        }
    } catch {}
}

if (-not $lanIp) {
    $lanIp = "127.0.0.1"
    Write-InfoMsg "Local Network (LAN) IP: Not detected (Isolated / Host-only)"
}

# 3. Public WAN IP (Safe check with 2s timeout for private / air-gapped networks)
$publicWanIp = ""
Write-InfoMsg "Probing Public WAN IP (timeout 2s)..."
try {
    $req = [System.Net.WebRequest]::Create("https://api.ipify.org")
    $req.Timeout = 2000
    $resp = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $publicWanIp = $reader.ReadToEnd().Trim()
    $reader.Close()
    $resp.Close()
    if ($publicWanIp -match "^\d+\.\d+\.\d+\.\d+$") {
        Write-Success "Public WAN IP: $publicWanIp"
    } else {
        $publicWanIp = ""
    }
} catch {
    $publicWanIp = ""
}

if (-not $publicWanIp) {
    Write-InfoMsg "Public WAN IP: None / Not reachable (Private Network / Intranet / Firewall)"
}

# 4. Determine Host Binding
$bindIp = "127.0.0.1"
if ($Public) {
    $bindIp = "0.0.0.0"
} elseif ($Local) {
    $bindIp = "127.0.0.1"
} elseif ($Bind) {
    $bindIp = $Bind
} elseif ($NonInteractive) {
    $bindIp = "127.0.0.1"
} else {
    Write-Host "`nNetwork Exposure Options:" -ForegroundColor Magenta
    Write-Host "  [1] Localhost Only (127.0.0.1)  -> Private & secure. Accessible only from this device (Recommended)"
    Write-Host "  [2] All Interfaces (0.0.0.0)    -> Expose to local network (LAN: $lanIp) / external hosts"
    $choice = Read-Host "Select binding option [1/2] (default: 1)"
    if ($choice -match "^(2|0\.0\.0\.0|public|all)$") {
        $bindIp = "0.0.0.0"
        Write-WarnMsg "Service will be exposed on 0.0.0.0 (Accessible to network at http://$($lanIp):8001)"
    } else {
        $bindIp = "127.0.0.1"
        Write-Success "Service will be bound to 127.0.0.1 (Localhost only)"
    }
}

# -----------------------------------------------------------------------------
# 3. DEPENDENCY AUDIT
# -----------------------------------------------------------------------------
Write-Step "Step 3: Checking Toolchain & Software Dependencies"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-ErrMsg "Git is not installed or not in PATH: https://git-scm.com/download/win"
    exit 1
}
Write-Success "Git detected."

if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyVer = python --version 2>&1
    Write-Success "Python: $pyVer"
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node --version 2>&1
    Write-Success "Node.js: $nodeVer"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ErrMsg "Docker is not detected in PATH: https://www.docker.com/products/docker-desktop"
    exit 1
}

try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-ErrMsg "Docker Desktop daemon is not running. Please start Docker Desktop and retry."
        exit 1
    }
} catch {
    Write-ErrMsg "Failed to connect to Docker daemon. Ensure Docker Desktop is active."
    exit 1
}
Write-Success "Docker daemon is active."

# -----------------------------------------------------------------------------
# 4. WORKSPACE SETUP
# -----------------------------------------------------------------------------
Write-Step "Step 4: Setting Up DRISTI-NET Workspace"

if (-not (Test-Path "docker-compose.yml")) {
    $targetDir = "DRISTI-NET"
    if (-not (Test-Path $targetDir)) {
        Write-Host "Cloning DRISTI-NET repository into .\$targetDir..."
        git clone https://github.com/vyber07/DRISTI-NET.git $targetDir
    }
    Set-Location $targetDir
}
Write-Success "Working directory: $(Get-Location)"

# -----------------------------------------------------------------------------
# 5. CONFIGURATION & SECRETS INITIALIZATION
# -----------------------------------------------------------------------------
Write-Step "Step 5: Initializing Configuration & Cryptographic Keys"

function New-CryptoHex([int]$bytes = 32) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buffer = New-Object byte[] $bytes
    $rng.GetBytes($buffer)
    return -join ($buffer | ForEach-Object { "{0:x2}" -f $_ })
}

if (-not (Test-Path ".env")) {
    Write-Host "Generating .env configuration from .env.example..."
    Copy-Item ".env.example" ".env"

    $secretKey = New-CryptoHex 32
    $pgPass    = New-CryptoHex 24
    $neoPass   = New-CryptoHex 24
    $minioPass = New-CryptoHex 24
    $k1        = New-CryptoHex 32
    $k2        = New-CryptoHex 32

    $envContent = Get-Content ".env" -Raw
    $envContent = $envContent -replace 'DRISTI_SECRET_KEY=change-me-demo-only', "DRISTI_SECRET_KEY=$secretKey"
    
    $extraVars = @"

# --- Deployment Credentials & Host Binding ---
DRISTI_BIND_IP=$bindIp
POSTGRES_PASSWORD=$pgPass
NEO4J_PASSWORD=$neoPass
MINIO_ROOT_PASSWORD=$minioPass
DRISTI_AUDIT_KEYS='{"k1-2026":"$k1","k2-2026":"$k2"}'
DRISTI_CURRENT_AUDIT_KEY_ID=k2-2026
"@
    Set-Content -Path ".env" -Value ($envContent + $extraVars)
    Write-Success "Created .env with secure random tokens (DRISTI_BIND_IP=$bindIp)."
} else {
    Write-Success "Existing .env configuration detected."
    # Synchronize DRISTI_BIND_IP
    $existing = Get-Content ".env" -Raw
    if ($existing -match "DRISTI_BIND_IP=") {
        $existing = $existing -replace "DRISTI_BIND_IP=.*", "DRISTI_BIND_IP=$bindIp"
        Set-Content -Path ".env" -Value $existing
    } else {
        Add-Content -Path ".env" -Value "`nDRISTI_BIND_IP=$bindIp"
    }
}
$env:DRISTI_BIND_IP = $bindIp

# -----------------------------------------------------------------------------
# 6. DATA SEEDING CONFIRMATION
# -----------------------------------------------------------------------------
$doSeed = $true
if ($NoSeed) {
    $doSeed = $false
} elseif ($Seed) {
    $doSeed = $true
} elseif ($NonInteractive) {
    $doSeed = $true
} else {
    Write-Host "`nData Seeding Option:" -ForegroundColor Magenta
    $seedAns = Read-Host "Seed demo accounts (investigator, analyst, supervisor, admin) and synthetic cases? [Y/n]"
    if ($seedAns -match "^[Nn]") {
        $doSeed = $false
        Write-InfoMsg "Demo seeding skipped by user choice."
    } else {
        $doSeed = $true
        Write-Success "Demo seeding enabled."
    }
}

# -----------------------------------------------------------------------------
# 7. DOCKER COMPOSE LAUNCH
# -----------------------------------------------------------------------------
Write-Step "Step 6: Launching DRISTI-NET Multi-Service Stack"

if ($Pull) {
    Write-InfoMsg "Checking and pulling latest verified service images (PostgreSQL, Neo4j, MinIO, Redis, Kafka, ClamAV)..."
    docker compose pull postgres neo4j minio redis kafka clamav
}

Write-Host "Starting Docker Compose services (DRISTI_BIND_IP=$bindIp)..."
docker compose up -d

Write-Host "Waiting for database and API containers to initialize..."
Start-Sleep -Seconds 10

# Database Migrations
Write-Host "Applying database migrations (Alembic)..."
docker compose exec -T -w /app/apps/api api alembic upgrade head

if ($doSeed) {
    Write-Host "Seeding demo accounts and synthetic cases..."
    docker compose exec -T api python3 -m apps.api.app.seed
}

# -----------------------------------------------------------------------------
# 8. VERIFY HEALTH & LAUNCH BROWSER
# -----------------------------------------------------------------------------
Write-Step "Step 7: Verifying Deployment Health"

$candidateUrls = @(
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://localhost:8000",
    "http://localhost"
)

$targetUrl = ""
foreach ($url in $candidateUrls) {
    try {
        $resp = Invoke-RestMethod -Uri "$url/api/v1/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp.status -eq "ok") {
            $targetUrl = $url
            Write-Success "Connected to healthy service endpoint: $targetUrl"
            break
        }
    } catch {
        # continue probing
    }
}

if (-not $targetUrl) {
    $targetUrl = "http://localhost:8001"
}

$networkUrl = ""
if ($bindIp -eq "0.0.0.0" -and $lanIp) {
    $networkUrl = "http://${lanIp}:8001"
}

if (-not $NoBrowser) {
    Write-Step "Step 8: Opening DRISTI-NET in Default Browser"
    Write-Host "Opening: $targetUrl"
    Start-Process $targetUrl
}

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
Write-Host @"

======================================================================
   DRISTI-NET PLATFORM IS DEPLOYED & OPERATIONAL (WINDOWS)
======================================================================

Access Endpoints:
  - Local Web UI:       $targetUrl
"@ -ForegroundColor Green

if ($networkUrl) {
    Write-Host "  - LAN Network UI:     $networkUrl" -ForegroundColor Green
}
if ($publicWanIp -and $bindIp -eq "0.0.0.0") {
    Write-Host "  - Public IP (if port-forwarded): http://${publicWanIp}:8001" -ForegroundColor Green
}
Write-Host "  - Interactive Docs:   $targetUrl/docs" -ForegroundColor Green

if ($doSeed) {
    Write-Host @"

Pre-configured Demo Accounts:
  - Investigator:  investigator  /  investigator-demo
  - Analyst:       analyst       /  analyst-demo
  - Supervisor:    supervisor    /  supervisor-demo
  - Auditor:       auditor       /  auditor-demo
  - Administrator: admin         /  admin-demo
"@ -ForegroundColor Yellow
}

Write-Host @"

Management Commands:
  - Status check:   docker compose ps
  - Live logs:      docker compose logs -f api
  - Stop stack:     docker compose stop
  - Restart stack:  docker compose restart

"@ -ForegroundColor Cyan
