#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#   ProTakeOff — One-Command Project Setup
#   Usage: chmod +x setup.sh && ./setup.sh
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}${BOLD}"
  echo "  ██████╗ ██████╗  ██████╗ ████████╗ █████╗ ██╗  ██╗███████╗ ██████╗ ███████╗███████╗"
  echo "  ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔══██╗██║ ██╔╝██╔════╝██╔═══██╗██╔════╝██╔════╝"
  echo "  ██████╔╝██████╔╝██║   ██║   ██║   ███████║█████╔╝ █████╗  ██║   ██║█████╗  █████╗  "
  echo "  ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██╔══██║██╔═██╗ ██╔══╝  ██║   ██║██╔══╝  ██╔══╝  "
  echo "  ██║     ██║  ██║╚██████╔╝   ██║   ██║  ██║██║  ██╗███████╗╚██████╔╝██║     ██║     "
  echo "  ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝     "
  echo -e "${RESET}"
  echo -e "  ${BOLD}Construction Takeoff & Estimation Platform${RESET}"
  echo -e "  ${CYAN}https://github.com/git-jainamshah/Protakeoff${RESET}"
  echo ""
}

step() { echo -e "\n${CYAN}▶  $1${RESET}"; }
ok()   { echo -e "${GREEN}✔  $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠  $1${RESET}"; }
fail() { echo -e "${RED}✘  $1${RESET}"; exit 1; }

banner

# ── Node version check ───────────────────────────────────────────
step "Checking Node.js version..."
NODE_VER=$(node -v 2>/dev/null || echo "none")
if [[ "$NODE_VER" == "none" ]]; then
  fail "Node.js not found. Install Node.js 20+ from https://nodejs.org"
fi
MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
if [ "$MAJOR" -lt 18 ]; then
  fail "Node.js 18+ required (found $NODE_VER)"
fi
ok "Node.js $NODE_VER"

# ── Install root dependencies ────────────────────────────────────
step "Installing root workspace dependencies..."
npm install --silent
ok "Root dependencies installed"

# ── Install backend dependencies ─────────────────────────────────
step "Installing backend dependencies..."
npm install --silent --prefix backend
ok "Backend dependencies installed"

# ── Install frontend dependencies ────────────────────────────────
step "Installing frontend dependencies..."
npm install --silent --prefix frontend
ok "Frontend dependencies installed"

# ── Backend env file ─────────────────────────────────────────────
step "Setting up environment variables..."
if [ ! -f backend/.env.local ]; then
  cp backend/.env.example backend/.env.local
  ok "Created backend/.env.local from .env.example"
  warn "Review backend/.env.local and update JWT_SECRET for production"
else
  ok "backend/.env.local already exists — skipping"
fi

# ── Prisma migration ─────────────────────────────────────────────
step "Running database migrations..."
cd backend
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy 2>/dev/null || \
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name init
ok "Database migrated"

# ── Prisma generate ──────────────────────────────────────────────
step "Generating Prisma client..."
DATABASE_URL="file:./prisma/dev.db" npx prisma generate --silent
ok "Prisma client generated"

# ── Seed demo data ───────────────────────────────────────────────
step "Seeding demo admin account..."
DATABASE_URL="file:./prisma/dev.db" npx tsx prisma/seed.ts 2>/dev/null && ok "Demo account seeded" || warn "Seed skipped (already exists or seed file not found)"
cd ..

# ── Done ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  ✔  ProTakeOff is ready!${RESET}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Start the app:${RESET}   ${CYAN}npm run dev${RESET}"
echo ""
echo -e "  ${BOLD}Frontend:${RESET}        ${CYAN}http://localhost:5173${RESET}"
echo -e "  ${BOLD}Backend API:${RESET}     ${CYAN}http://localhost:5000${RESET}"
echo -e "  ${BOLD}DB Studio:${RESET}       ${CYAN}npm run prisma:studio${RESET}"
echo ""
echo -e "  ${BOLD}Demo Login:${RESET}      admin@protakeoff.dev / ProTakeOff@2026"
echo -e "  ${BOLD}Credentials:${RESET}     See CREDENTIALS.local.txt"
echo -e "  ${BOLD}Architecture:${RESET}    See ARCHITECTURE.md"
echo ""
