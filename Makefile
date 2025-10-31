# ============================================================================
# Carsu Multi-Tenant Todo App - Makefile
# ============================================================================
# Simple commands for common development tasks.
# Demonstrates automation and developer experience focus.
#
# Usage:
#   make setup      - One-command setup (build, start, migrate, verify)
#   make start      - Start all services (assumes already built)
#   make stop       - Stop all services
#   make restart    - Restart all services
#   make logs       - View all logs (follow mode)
#   make clean      - Stop and remove all containers, volumes, networks
#   make test       - Run tests (API tests)
#   make status     - Show service status
# ============================================================================

# Detect Docker Compose command (prefer v2, fallback to v1)
DOCKER_COMPOSE := $(shell command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && echo "docker compose" || (command -v docker-compose >/dev/null 2>&1 && echo "docker-compose" || echo ""))

.PHONY: help setup start stop restart logs clean test status api-logs web-logs db-logs

# Check if Docker Compose is available
ifeq ($(DOCKER_COMPOSE),)
$(error Docker Compose not found. Please install Docker Compose: https://docs.docker.com/compose/install/)
endif

# Default target
help:
	@echo "Carsu Multi-Tenant Todo App - Available Commands:"
	@echo ""
	@echo "  make setup      - Complete setup (build, start, migrate, verify)"
	@echo "  make start      - Start all services"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make logs       - View all logs (follow mode)"
	@echo "  make api-logs   - View API logs only"
	@echo "  make web-logs   - View frontend logs only"
	@echo "  make db-logs    - View database logs only"
	@echo "  make clean      - Stop and remove everything"
	@echo "  make test       - Run API tests"
	@echo "  make status     - Show service status"
	@echo ""

# One-command setup - the main command interviewers will use
setup:
	@chmod +x setup.sh
	@./setup.sh

# Start services (assumes already built)
start:
	@echo "Starting all services..."
	@$(DOCKER_COMPOSE) up -d
	@echo "✓ Services started. Use 'make logs' to view logs."

# Stop services
stop:
	@echo "Stopping all services..."
	@$(DOCKER_COMPOSE) stop
	@echo "✓ Services stopped."

# Restart services
restart:
	@echo "Restarting all services..."
	@$(DOCKER_COMPOSE) restart
	@echo "✓ Services restarted."

# View logs (all services)
logs:
	@$(DOCKER_COMPOSE) logs -f

# View API logs only
api-logs:
	@$(DOCKER_COMPOSE) logs -f api

# View frontend logs only
web-logs:
	@$(DOCKER_COMPOSE) logs -f web

# View database logs only
db-logs:
	@$(DOCKER_COMPOSE) logs -f db

# Clean everything (containers, volumes, networks)
clean:
	@echo "Cleaning up all containers, volumes, and networks..."
	@$(DOCKER_COMPOSE) down -v
	@docker rm -f carsu_api carsu_web carsu_db 2>/dev/null || true
	@echo "✓ Cleanup complete."

# Run tests
test:
	@echo "Running API tests..."
	@cd apps/api && pnpm test

# Show service status
status:
	@$(DOCKER_COMPOSE) ps
	@echo ""
	@echo "Service URLs:"
	@echo "  Frontend: http://localhost:5174"
	@echo "  API:      http://localhost:4000"
	@echo "  Docs:     http://localhost:4000/docs"

