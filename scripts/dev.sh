#!/usr/bin/env bash
set -euo pipefail

# Start full stack (DB, API, Web) in Docker and print access URLs
cd "$(dirname "$0")/.."

echo "[dev] Bringing up Docker stack (build + up -d) ..."
docker-compose up -d --build

API_URL="http://localhost:4000"
HEALTH_ENDPOINT="$API_URL/v1/health"
DOCS_URL="$API_URL/docs"
WEB_URL="http://localhost:5174"

echo "[dev] Waiting for API health at $HEALTH_ENDPOINT ..."
for i in {1..30}; do
  if curl -sf "$HEALTH_ENDPOINT" >/dev/null; then
    echo "[dev] API is healthy."
    break
  fi
  sleep 1
done

echo "\n[dev] URLs:"
echo "- Web:  $WEB_URL"
echo "- Docs: $DOCS_URL"
echo "- Health: $HEALTH_ENDPOINT"

echo "\n[dev] To view logs: docker-compose logs -f"
echo "[dev] To stop: docker-compose down -v"


