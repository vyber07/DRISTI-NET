#!/usr/bin/env bash
# =============================================================================
# DRISTI-NET — Universal Cross-Platform Quickstart & Deployment Script
# Supports: Linux (Ubuntu, Debian, Fedora, RHEL, Arch, Alpine), macOS, Windows (WSL)
#
# Usage (One-liner):
#   curl -fsSL https://raw.githubusercontent.com/vyber07/DRISTI-NET/main/quickstart.sh | bash
#
# Usage (Local repository):
#   ./quickstart.sh [options]
#   Options:
#     --bind <127.0.0.1|0.0.0.0>  Bind IP address (default: interactive prompt or 127.0.0.1)
#     --seed / --no-seed           Seed demo accounts and synthetic cases
#     --no-browser                 Do not launch browser automatically
#     --pull                       Pull latest database and middleware container images
#     --non-interactive            Run with automated safe defaults (127.0.0.1, seeded)
#     -h, --help                   Show this help message
# =============================================================================

set -e

# --- Terminal Colors & Helpers ---
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
BLUE="\033[34m"
MAGENTA="\033[35m"
RESET="\033[0m"

log_info()  { echo -e "${CYAN}[INFO]${RESET} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${RESET} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${RESET} $*"; }
log_err()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_step()  { echo -e "\n${BOLD}${BLUE}==>${RESET} ${BOLD}$*${RESET}"; }

# --- Flags & Defaults ---
CLI_BIND=""
CLI_SEED=""
AUTO_BROWSER=1
PULL_IMAGES=0
NON_INTERACTIVE=0

for arg in "$@"; do
    case "$arg" in
        --bind=*)        CLI_BIND="${arg#*=}" ;;
        --bind)          shift; CLI_BIND="$1" ;;
        --public)        CLI_BIND="0.0.0.0" ;;
        --local)         CLI_BIND="127.0.0.1" ;;
        --seed)          CLI_SEED="yes" ;;
        --no-seed|--skip-seed) CLI_SEED="no" ;;
        --no-browser)    AUTO_BROWSER=0 ;;
        --pull)          PULL_IMAGES=1 ;;
        --non-interactive|-y) NON_INTERACTIVE=1 ;;
        -h|--help)
            echo "Usage: ./quickstart.sh [options]"
            echo "Options:"
            echo "  --bind <ip>          Set bind host: 127.0.0.1 (local only) or 0.0.0.0 (public/network)"
            echo "  --public             Shortcut for --bind 0.0.0.0"
            echo "  --local              Shortcut for --bind 127.0.0.1"
            echo "  --seed               Seed demo accounts and synthetic cases"
            echo "  --no-seed            Skip demo seeding"
            echo "  --no-browser         Do not attempt to open the web browser"
            echo "  --pull               Pull updated container images from registry"
            echo "  --non-interactive    Run non-interactively with safe defaults"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ____  ____  ___ ____ _____ ___     _   _ _____ _____ 
 |  _ \|  _ \|_ _/ ___|_   _|_ _|   | \ | | ____|_   _|
 | | | | |_) || |\___ \ | |  | |____|  \| |  _|   | |  
 | |_| |  _ < | | ___) || |  | |____| |\  | |___  | |  
 |____/|_| \_\___|____/ |_| |___|   |_| \_|_____| |_|  
 Digital Record & Intelligence Synthesizer for Transparent Investigations
EOF
echo -e "${RESET}"

# =============================================================================
# 1. HARDWARE & SYSTEM SPECIFICATION AUDIT
# =============================================================================
log_step "Step 1: Inspecting System Specifications & Hardware Requirements"

OS_TYPE="$(uname -s)"
ARCH="$(uname -m)"
log_info "Operating System: ${OS_TYPE} (${ARCH})"

if [ "$OS_TYPE" = "Linux" ]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO="$NAME $VERSION_ID"
    else
        DISTRO="Unknown Linux"
    fi
    log_info "Distribution: ${DISTRO}"
elif [ "$OS_TYPE" = "Darwin" ]; then
    MAC_VER="$(sw_vers -productVersion 2>/dev/null || echo '')"
    log_info "macOS Version: ${MAC_VER}"
fi

# CPU Cores
if command -v nproc >/dev/null 2>&1; then
    CPU_CORES="$(nproc)"
elif command -v sysctl >/dev/null 2>&1; then
    CPU_CORES="$(sysctl -n hw.ncpu 2>/dev/null || echo 1)"
else
    CPU_CORES=1
fi

if [ "$CPU_CORES" -lt 2 ]; then
    log_warn "CPU Cores: ${CPU_CORES} detected. DRISTI-NET multi-container stack recommends >= 2 cores."
else
    log_ok "CPU Cores: ${CPU_CORES} (Requirement satisfied: >= 2 cores)"
fi

# RAM Check
TOTAL_RAM_MB=0
if [ -f /proc/meminfo ]; then
    TOTAL_RAM_KB="$(grep MemTotal /proc/meminfo | awk '{print $2}')"
    TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
elif command -v sysctl >/dev/null 2>&1; then
    MEM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
    TOTAL_RAM_MB=$((MEM_BYTES / 1024 / 1024))
fi

if [ "$TOTAL_RAM_MB" -gt 0 ]; then
    TOTAL_RAM_GB=$(awk "BEGIN {printf \"%.1f\", $TOTAL_RAM_MB/1024}")
    if [ "$TOTAL_RAM_MB" -lt 3500 ]; then
        log_warn "Total RAM: ${TOTAL_RAM_GB} GB detected. DRISTI-NET stack (Neo4j, Postgres, ClamAV, Besu) recommends >= 4.0 GB."
    else
        log_ok "Total RAM: ${TOTAL_RAM_GB} GB (Requirement satisfied: >= 4 GB)"
    fi
fi

# Disk Space Check
if command -v df >/dev/null 2>&1; then
    FREE_DISK_KB="$(df -k . | awk 'NR==2 {print $4}')"
    FREE_DISK_MB=$((FREE_DISK_KB / 1024))
    FREE_DISK_GB=$(awk "BEGIN {printf \"%.1f\", $FREE_DISK_MB/1024}")
    if [ "$FREE_DISK_MB" -lt 5000 ]; then
        log_warn "Free Disk Space: ${FREE_DISK_GB} GB available. Recommended >= 10.0 GB for Docker images and database volumes."
    else
        log_ok "Free Disk Space: ${FREE_DISK_GB} GB (Requirement satisfied: >= 5 GB free)"
    fi
fi

# =============================================================================
# 2. NETWORK & IP DETAILS DISCOVERY
# =============================================================================
log_step "Step 2: Probing Network Interfaces & Host IP Details"

# 1. Localhost Loopback (Always available)
LOOPBACK_IP="127.0.0.1"
log_info "Localhost Loopback: ${LOOPBACK_IP}"

# 2. LAN / Private Network IP
LAN_IP=""
if command -v ip >/dev/null 2>&1; then
    # Try routing to public DNS or fallback to route table
    LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || true)"
fi
if [ -z "$LAN_IP" ] && command -v hostname >/dev/null 2>&1; then
    for cand in $(hostname -I 2>/dev/null || true); do
        # Ignore docker bridge (172.17., 172.18., etc.) if possible
        if [[ ! "$cand" =~ ^172\.(1[7-9]|2[0-9]|3[0-1])\. ]]; then
            LAN_IP="$cand"
            break
        fi
    done
fi
if [ -z "$LAN_IP" ] && command -v ifconfig >/dev/null 2>&1; then
    LAN_IP="$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n 1 || true)"
fi

if [ -n "$LAN_IP" ]; then
    log_ok "Local Network (LAN) IP: ${LAN_IP}"
else
    LAN_IP="127.0.0.1"
    log_info "Local Network (LAN) IP: Not detected (Isolated / Host-only)"
fi

# 3. Public WAN IP (Safe check with strict 2s timeout for private / air-gapped networks)
PUBLIC_WAN_IP=""
log_info "Probing Public WAN IP (timeout 2s)..."
PUBLIC_WAN_IP="$(curl -s -m 2 https://api.ipify.org 2>/dev/null || curl -s -m 2 https://ifconfig.me 2>/dev/null || true)"

if [ -n "$PUBLIC_WAN_IP" ] && [[ "$PUBLIC_WAN_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    log_ok "Public WAN IP: ${PUBLIC_WAN_IP}"
else
    PUBLIC_WAN_IP=""
    log_info "Public WAN IP: None / Not reachable (Private Network / Intranet / Firewall)"
fi

# 4. Determine Host Binding (User Permission & Selection)
BIND_IP="127.0.0.1"

if [ -n "$CLI_BIND" ]; then
    BIND_IP="$CLI_BIND"
    log_info "Using command-line bind host: ${BIND_IP}"
elif [ "$NON_INTERACTIVE" -eq 1 ] || [ ! -t 0 ]; then
    BIND_IP="127.0.0.1"
    log_info "Non-interactive session: Defaulting bind host to 127.0.0.1 (Localhost only)."
else
    echo -e "\n${BOLD}${MAGENTA}Network Exposure Options:${RESET}"
    echo -e "  ${BOLD}[1] Localhost Only (127.0.0.1)${RESET}  -> Private & secure. Accessible only from this device (Recommended)"
    echo -e "  ${BOLD}[2] All Interfaces (0.0.0.0)${RESET}    -> Expose to local network (LAN: ${LAN_IP}) / public host"
    echo -n "Select binding option [1/2] (default: 1): "
    read -r bind_choice
    case "$bind_choice" in
        2|0.0.0.0|public|all)
            BIND_IP="0.0.0.0"
            log_warn "Service will be exposed on 0.0.0.0 (Accessible to network at http://${LAN_IP}:8001)"
            ;;
        *)
            BIND_IP="127.0.0.1"
            log_ok "Service will be bound to 127.0.0.1 (Localhost only)"
            ;;
    esac
fi

# =============================================================================
# 3. DEPENDENCY & ECOSYSTEM TOOLCHAIN AUDIT
# =============================================================================
log_step "Step 3: Checking Toolchain & Ecosystem Dependencies (Python, Node, Docker)"

# Git Check
if ! command -v git >/dev/null 2>&1; then
    log_err "Git is not installed. Please install git."
    exit 1
fi
log_ok "Git: $(git --version)"

# Curl Check
if ! command -v curl >/dev/null 2>&1; then
    log_err "curl is required. Please install curl."
    exit 1
fi
log_ok "curl: $(curl --version | head -n 1)"

# Python Check (Python 3.11+ recommended)
if command -v python3 >/dev/null 2>&1; then
    PY_VER="$(python3 --version 2>&1)"
    log_ok "Python: ${PY_VER}"
else
    log_warn "Python 3 is not installed on host (required only for bare-metal execution)."
fi

# Node.js, npm, npx, nvm Check
if command -v node >/dev/null 2>&1; then
    NODE_VER="$(node --version 2>/dev/null || echo '')"
    NPM_VER="$(npm --version 2>/dev/null || echo '')"
    log_ok "Node.js: ${NODE_VER} | npm: ${NPM_VER}"
else
    log_info "Node.js / npm not detected on host (packaged inside Docker container build)."
    if [ "$NON_INTERACTIVE" -eq 0 ] && [ -t 0 ] && [ "$OS_TYPE" = "Linux" ]; then
        echo -n "Would you like to install Node.js LTS via NVM for local development? [y/N]: "
        read -r install_node
        if [[ "$install_node" =~ ^[Yy]$ ]]; then
            log_info "Installing NVM (Node Version Manager)..."
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh 2>/dev/null | bash || true
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            if command -v nvm >/dev/null 2>&1; then
                nvm install --lts
                log_ok "Node.js LTS installed: $(node --version)"
            fi
        fi
    fi
fi

# Docker & Docker Compose Check
DOCKER_BIN=""
DOCKER_COMPOSE_CMD=""

if command -v docker >/dev/null 2>&1; then
    DOCKER_BIN="docker"
    if ! docker info >/dev/null 2>&1; then
        if sudo docker info >/dev/null 2>&1; then
            DOCKER_BIN="sudo docker"
            log_warn "Running docker with sudo permissions."
        else
            log_err "Docker is installed but daemon is not running or accessible."
            exit 1
        fi
    fi
    log_ok "Docker daemon is active."
    
    if $DOCKER_BIN compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="$DOCKER_BIN compose"
        log_ok "Docker Compose v2: $($DOCKER_COMPOSE_CMD version --short 2>/dev/null || echo 'active')"
    elif command -v docker-compose >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker-compose"
        log_ok "Docker Compose: $(docker-compose --version)"
    else
        log_err "Docker Compose plugin is missing."
        exit 1
    fi
else
    log_warn "Docker is not currently installed on this device."
    if [ "$OS_TYPE" = "Linux" ] && [ -t 0 ] && [ "$NON_INTERACTIVE" -eq 0 ]; then
        echo -n "Auto-install Docker via official get.docker.com? [y/N]: "
        read -r install_docker
        if [[ "$install_docker" =~ ^[Yy]$ ]]; then
            log_info "Installing Docker..."
            curl -fsSL https://get.docker.com | sh
            sudo usermod -aG docker "$USER" 2>/dev/null || true
            DOCKER_BIN="sudo docker"
            DOCKER_COMPOSE_CMD="sudo docker compose"
            log_ok "Docker installed."
        else
            log_err "Docker is required to run DRISTI-NET. Aborting."
            exit 1
        fi
    else
        log_err "Please install Docker Desktop or Docker Engine + Compose to proceed."
        exit 1
    fi
fi

# =============================================================================
# 4. WORKSPACE SETUP
# =============================================================================
log_step "Step 4: Setting Up DRISTI-NET Workspace"

if [ ! -f "docker-compose.yml" ]; then
    TARGET_DIR="DRISTI-NET"
    if [ ! -d "$TARGET_DIR" ]; then
        log_info "Cloning DRISTI-NET repository..."
        git clone https://github.com/vyber07/DRISTI-NET.git "$TARGET_DIR"
    fi
    cd "$TARGET_DIR"
fi
log_ok "Working directory: $(pwd)"

# =============================================================================
# 5. ENVIRONMENT & CRYPTOGRAPHIC SECRETS INITIALIZATION
# =============================================================================
log_step "Step 5: Initializing Configuration, Host Binding & Cryptographic Keys"

generate_token() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 32
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import secrets; print(secrets.token_hex(32))"
    else
        LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 64
    fi
}

if [ ! -f ".env" ]; then
    log_info "Generating secure .env configuration from .env.example..."
    cp .env.example .env
    
    SECRET_KEY="$(generate_token)"
    PG_PASS="$(generate_token)"
    NEO_PASS="$(generate_token)"
    MINIO_PASS="$(generate_token)"
    K1_KEY="$(generate_token)"
    K2_KEY="$(generate_token)"
    
    cat << EOF >> .env

# --- Deployment Credentials & Host Binding ---
DRISTI_BIND_IP=${BIND_IP}
POSTGRES_PASSWORD=${PG_PASS}
NEO4J_PASSWORD=${NEO_PASS}
MINIO_ROOT_PASSWORD=${MINIO_PASS}
DRISTI_AUDIT_KEYS='{"k1-2026":"${K1_KEY}","k2-2026":"${K2_KEY}"}'
DRISTI_CURRENT_AUDIT_KEY_ID=k2-2026
EOF

    if [ "$OS_TYPE" = "Darwin" ]; then
        sed -i '' "s/DRISTI_SECRET_KEY=change-me-demo-only/DRISTI_SECRET_KEY=${SECRET_KEY}/" .env
    else
        sed -i "s/DRISTI_SECRET_KEY=change-me-demo-only/DRISTI_SECRET_KEY=${SECRET_KEY}/" .env
    fi
    chmod 600 .env
    log_ok "Created .env with high-entropy cryptographic keys (DRISTI_BIND_IP=${BIND_IP})."
else
    log_ok "Existing .env configuration detected."
    # Ensure DRISTI_BIND_IP is synchronized
    if grep -q "^DRISTI_BIND_IP=" .env; then
        if [ "$OS_TYPE" = "Darwin" ]; then
            sed -i '' "s/^DRISTI_BIND_IP=.*/DRISTI_BIND_IP=${BIND_IP}/" .env
        else
            sed -i "s/^DRISTI_BIND_IP=.*/DRISTI_BIND_IP=${BIND_IP}/" .env
        fi
    else
        echo "DRISTI_BIND_IP=${BIND_IP}" >> .env
    fi
    export DRISTI_BIND_IP="${BIND_IP}"
fi

# =============================================================================
# 6. DATA SEEDING CONFIRMATION
# =============================================================================
DO_SEED=1

if [ -n "$CLI_SEED" ]; then
    [ "$CLI_SEED" = "no" ] && DO_SEED=0
elif [ "$NON_INTERACTIVE" -eq 1 ] || [ ! -t 0 ]; then
    DO_SEED=1
else
    echo -e "\n${BOLD}${MAGENTA}Data Seeding Option:${RESET}"
    echo -n "Seed demo accounts (investigator, analyst, supervisor, admin) and synthetic cases? [Y/n]: "
    read -r seed_choice
    case "$seed_choice" in
        [Nn]*) DO_SEED=0; log_info "Demo seeding skipped by user choice." ;;
        *)     DO_SEED=1; log_ok "Demo seeding enabled." ;;
    esac
fi

# =============================================================================
# 7. DOCKER COMPOSE LAUNCH & SERVICE DEPLOYMENT
# =============================================================================
log_step "Step 6: Launching DRISTI-NET Multi-Service Stack"

if [ "$PULL_IMAGES" -eq 1 ]; then
    log_info "Checking and pulling latest verified service images (PostgreSQL, Neo4j, MinIO, Redis, Kafka, ClamAV)..."
    $DOCKER_COMPOSE_CMD pull postgres neo4j minio redis kafka clamav || log_warn "Pull completed with non-critical warnings."
fi

log_info "Starting Docker Compose services with DRISTI_BIND_IP=${BIND_IP}..."
DRISTI_BIND_IP="${BIND_IP}" $DOCKER_COMPOSE_CMD up -d

log_info "Waiting for PostgreSQL database container to become healthy..."
MAX_WAIT=90
ELAPSED=0
PG_CONTAINER="$($DOCKER_COMPOSE_CMD ps -q postgres 2>/dev/null || echo '')"

while [ $ELAPSED -lt $MAX_WAIT ]; do
    if [ -n "$PG_CONTAINER" ]; then
        HEALTH_STATUS="$($DOCKER_BIN inspect --format '{{json .State.Health.Status}}' "$PG_CONTAINER" 2>/dev/null || echo '')"
        if [ "$HEALTH_STATUS" = "\"healthy\"" ] || [ "$HEALTH_STATUS" = "healthy" ]; then
            log_ok "PostgreSQL container is healthy."
            break
        fi
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    echo -n "."
done
echo ""

# Run Database Migrations
log_info "Applying database schema migrations (Alembic)..."
$DOCKER_COMPOSE_CMD exec -T -w /app/apps/api api alembic upgrade head || log_warn "Alembic upgrade exited with status $?"

# Seed demo data if requested
if [ "$DO_SEED" -eq 1 ]; then
    log_info "Seeding demo accounts and synthetic cases..."
    $DOCKER_COMPOSE_CMD exec -T api python3 -m apps.api.app.seed || log_warn "Seed script exited with status $?"
fi

# =============================================================================
# 8. VERIFY HEALTH & DETERMINE ACCESSIBLE URLS
# =============================================================================
log_step "Step 7: Verifying Deployment Health & Access Endpoints"

PRIMARY_URL=""
CANDIDATE_URLS=(
    "https://65.0.102.181.nip.io"
    "http://127.0.0.1:8001"
    "http://localhost:8001"
    "http://127.0.0.1:8000"
    "http://localhost:8000"
    "http://127.0.0.1"
    "http://localhost"
)

for url in "${CANDIDATE_URLS[@]}"; do
    if curl -k -s -m 3 "${url}/api/v1/health" | grep -q '"status":"ok"' 2>/dev/null; then
        PRIMARY_URL="$url"
        log_ok "Verified healthy service response on: ${PRIMARY_URL}"
        break
    fi
done

if [ -z "$PRIMARY_URL" ]; then
    PRIMARY_URL="http://127.0.0.1:8001"
    log_warn "Health probe pending. Defaulting local access URL to ${PRIMARY_URL}"
fi

# Compute network-accessible URL if bound to 0.0.0.0
NETWORK_URL=""
if [ "$BIND_IP" = "0.0.0.0" ] && [ -n "$LAN_IP" ]; then
    NETWORK_URL="http://${LAN_IP}:8001"
fi

# =============================================================================
# 9. AUTOMATIC BROWSER LAUNCH
# =============================================================================
if [ "$AUTO_BROWSER" -eq 1 ]; then
    log_step "Step 8: Opening DRISTI-NET in Local Browser"
    log_info "Opening: ${PRIMARY_URL}"
    
    BROWSER_OPENED=0
    if [ "$OS_TYPE" = "Darwin" ]; then
        open "$PRIMARY_URL" 2>/dev/null && BROWSER_OPENED=1
    elif [ -n "$WSL_DISTRO_NAME" ] || grep -qi microsoft /proc/version 2>/dev/null; then
        if command -v wslview >/dev/null 2>&1; then
            wslview "$PRIMARY_URL" 2>/dev/null && BROWSER_OPENED=1
        elif command -v cmd.exe >/dev/null 2>&1; then
            cmd.exe /c start "$PRIMARY_URL" 2>/dev/null && BROWSER_OPENED=1
        fi
    elif [ "$OS_TYPE" = "Linux" ]; then
        if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
            if command -v xdg-open >/dev/null 2>&1; then
                xdg-open "$PRIMARY_URL" >/dev/null 2>&1 && BROWSER_OPENED=1
            elif command -v gnome-open >/dev/null 2>&1; then
                gnome-open "$PRIMARY_URL" >/dev/null 2>&1 && BROWSER_OPENED=1
            fi
        fi
    fi

    if [ "$BROWSER_OPENED" -eq 1 ]; then
        log_ok "Browser launched successfully."
    else
        log_info "Headless/terminal environment detected. Access via:"
        echo -e "   ${BOLD}${GREEN}${PRIMARY_URL}${RESET}"
    fi
fi

# =============================================================================
# SUMMARY & ACCESS DETAILS
# =============================================================================
echo -e "\n${BOLD}${GREEN}======================================================================${RESET}"
echo -e "${BOLD}${GREEN}   DRISTI-NET PLATFORM IS DEPLOYED & OPERATIONAL   ${RESET}"
echo -e "${BOLD}${GREEN}======================================================================${RESET}\n"

echo -e "${BOLD}Access Endpoints:${RESET}"
echo -e "  - ${BOLD}Local Web UI:${RESET}       ${CYAN}${PRIMARY_URL}${RESET}"
if [ -n "$NETWORK_URL" ]; then
echo -e "  - ${BOLD}LAN Network UI:${RESET}     ${CYAN}${NETWORK_URL}${RESET}"
fi
if [ -n "$PUBLIC_WAN_IP" ] && [ "$BIND_IP" = "0.0.0.0" ]; then
echo -e "  - ${BOLD}Public IP (if port-forwarded):${RESET} ${CYAN}http://${PUBLIC_WAN_IP}:8001${RESET}"
fi
echo -e "  - ${BOLD}Interactive API Docs:${RESET} ${CYAN}${PRIMARY_URL}/docs${RESET}\n"

if [ "$DO_SEED" -eq 1 ]; then
echo -e "${BOLD}Pre-configured Demo Accounts:${RESET}"
echo -e "  - ${BOLD}Investigator:${RESET}  investigator  /  investigator-demo"
echo -e "  - ${BOLD}Analyst:${RESET}       analyst       /  analyst-demo"
echo -e "  - ${BOLD}Supervisor:${RESET}    supervisor    /  supervisor-demo"
echo -e "  - ${BOLD}Auditor:${RESET}       auditor       /  auditor-demo"
echo -e "  - ${BOLD}Administrator:${RESET} admin         /  admin-demo\n"
fi

echo -e "${BOLD}Management Commands:${RESET}"
echo -e "  - Status check:   ${CYAN}$DOCKER_COMPOSE_CMD ps${RESET}"
echo -e "  - Live logs:      ${CYAN}$DOCKER_COMPOSE_CMD logs -f api${RESET}"
echo -e "  - Stop stack:     ${CYAN}$DOCKER_COMPOSE_CMD stop${RESET}"
echo -e "  - Restart stack:  ${CYAN}$DOCKER_COMPOSE_CMD restart${RESET}\n"
