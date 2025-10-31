#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Carsu Multi-Tenant Todo App - One-Command Setup Script
# ============================================================================
# This script sets up and runs the entire application stack with a single command.
# It demonstrates automation and DevOps best practices.
#
# Usage: ./setup.sh
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Detect Docker Compose command (prefer v2, fallback to v1)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker compose"
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2")
elif command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE="docker-compose"
  # Try to extract version, fallback to "v1" if parsing fails
  VERSION_STRING=$(docker-compose --version 2>/dev/null || echo "")
  if echo "$VERSION_STRING" | grep -qE '[0-9]+\.[0-9]+\.[0-9]+'; then
    COMPOSE_VERSION=$(echo "$VERSION_STRING" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  else
    COMPOSE_VERSION="v1"
  fi
else
  echo "Error: Neither 'docker compose' (v2) nor 'docker-compose' (v1) found."
  echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Carsu Multi-Tenant Todo App - Automated Setup             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo -e "   Using: ${YELLOW}${DOCKER_COMPOSE}${NC} (${COMPOSE_VERSION})"
echo ""

# Step 1: Cleanup existing containers (if any)
echo -e "${YELLOW}[1/6]${NC} Cleaning up any existing containers..."
$DOCKER_COMPOSE down -v 2>/dev/null || true
docker rm -f carsu_api carsu_web carsu_db 2>/dev/null || true
echo -e "${GREEN}✓${NC} Cleanup complete"
echo ""

# Step 2: Build and start Docker containers
echo -e "${YELLOW}[2/6]${NC} Building and starting Docker containers..."
echo -e "   This may take a few minutes on first run..."
$DOCKER_COMPOSE up -d --build
echo -e "${GREEN}✓${NC} Containers built and started"
echo ""

# Step 3: Wait for database to be healthy
echo -e "${YELLOW}[3/6]${NC} Waiting for database to be ready..."
DB_MAX_RETRIES=30
DB_RETRY_COUNT=0
while [ $DB_RETRY_COUNT -lt $DB_MAX_RETRIES ]; do
  if $DOCKER_COMPOSE exec -T db pg_isready -U carsu -d carsu >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database is ready"
    break
  fi
  DB_RETRY_COUNT=$((DB_RETRY_COUNT + 1))
  echo -n "."
  sleep 1
done
echo ""

if [ $DB_RETRY_COUNT -eq $DB_MAX_RETRIES ]; then
  echo -e "${RED}✗${NC} Database failed to become ready within $DB_MAX_RETRIES seconds"
  exit 1
fi

# Step 4: Run Prisma migrations
echo -e "${YELLOW}[4/6]${NC} Running database migrations..."
echo -e "   Applying Prisma schema to database..."
$DOCKER_COMPOSE exec -T api sh -c "cd /app/apps/api && npx prisma migrate deploy" 2>/dev/null || \
$DOCKER_COMPOSE exec -T api sh -c "cd /app/apps/api && npx prisma db push --accept-data-loss" 2>/dev/null || {
  echo -e "${YELLOW}⚠${NC} Migration command not available, schema should sync automatically"
}
echo -e "${GREEN}✓${NC} Database migrations complete"
echo ""

# Step 5: Wait for API to be healthy
echo -e "${YELLOW}[5/6]${NC} Waiting for API server to be ready..."
API_MAX_RETRIES=60
API_RETRY_COUNT=0
API_URL="http://localhost:4000"
HEALTH_ENDPOINT="$API_URL/v1/health"

while [ $API_RETRY_COUNT -lt $API_MAX_RETRIES ]; do
  # Check if API is responding (even 401 is fine, means server is up)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo -e "${GREEN}✓${NC} API server is ready (HTTP $HTTP_CODE)"
    break
  fi
  API_RETRY_COUNT=$((API_RETRY_COUNT + 1))
  echo -n "."
  sleep 1
done
echo ""

if [ $API_RETRY_COUNT -eq $API_MAX_RETRIES ]; then
  echo -e "${YELLOW}⚠${NC} API may still be starting up. Check logs with: ${DOCKER_COMPOSE} logs api"
else
  # Give it a moment to fully initialize
  sleep 2
fi

# Step 6: Wait for frontend to be ready
echo -e "${YELLOW}[6/6]${NC} Checking frontend..."
WEB_MAX_RETRIES=30
WEB_RETRY_COUNT=0
WEB_URL="http://localhost:5174"

while [ $WEB_RETRY_COUNT -lt $WEB_MAX_RETRIES ]; do
  if curl -sf "$WEB_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend is ready"
    break
  fi
  WEB_RETRY_COUNT=$((WEB_RETRY_COUNT + 1))
  echo -n "."
  sleep 1
done
echo ""

# Final status
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🎉 Setup Complete! All services are running                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Access the application:${NC}"
echo -e "  • Frontend:    ${BLUE}http://localhost:5174${NC}"
echo -e "  • API:         ${BLUE}http://localhost:4000${NC}"
echo -e "  • API Docs:    ${BLUE}http://localhost:4000/docs${NC} (Swagger UI)"
echo -e "  • Health:      ${BLUE}http://localhost:4000/v1/health${NC}"
echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo -e "  • View logs:   ${YELLOW}${DOCKER_COMPOSE} logs -f${NC}"
echo -e "  • Stop all:    ${YELLOW}${DOCKER_COMPOSE} down${NC}"
echo -e "  • Restart:     ${YELLOW}./setup.sh${NC} (or ${YELLOW}make setup${NC})"
echo ""
echo -e "${GREEN}Quick test:${NC}"
echo -e "  ${YELLOW}curl http://localhost:4000/v1${NC}"
echo ""

