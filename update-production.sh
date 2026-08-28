#!/bin/bash

# ============================================
# TICKETING ADMIN - PRODUCTION UPDATE SCRIPT
# ============================================
# Updates running Ticketing Admin with latest code from git
# Performs zero-downtime update when possible
# Domain: https://ticketing.intuspath.com
# ============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.production.yml"
CONTAINER_NAME="ticketing-admin"
HEALTH_ENDPOINT="http://localhost:3004/api/health"
MAX_HEALTH_RETRIES=30
HEALTH_RETRY_DELAY=2

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# Pre-flight Checks
# ============================================

log_info "Starting Ticketing Admin production update..."
echo ""

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env.production file not found!"
    exit 1
fi
log_success ".env.production found"

# Check if Docker Compose V2 is available
if ! docker compose version &> /dev/null; then
    log_error "Docker Compose V2 is not available"
    exit 1
fi
log_success "Docker Compose V2 is available"

# ============================================
# Git Status Check
# ============================================

log_info "Checking git status..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    log_error "You have uncommitted changes!"
    log_error "Please commit or stash changes before updating"
    log_info "Current status:"
    git status --short
    exit 1
fi

log_success "No uncommitted changes"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
log_info "Current branch: $CURRENT_BRANCH"

# Get current commit
BEFORE_COMMIT=$(git rev-parse --short HEAD)
log_info "Current commit: $BEFORE_COMMIT"
echo ""

# ============================================
# Pull Latest Changes
# ============================================

log_info "Pulling latest changes from origin/$CURRENT_BRANCH..."

if ! git pull origin "$CURRENT_BRANCH"; then
    log_error "Git pull failed"
    exit 1
fi

AFTER_COMMIT=$(git rev-parse --short HEAD)

if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    log_warning "No new changes to deploy"
    log_info "Already at latest commit: $AFTER_COMMIT"
    echo ""

    # Ask if user wants to rebuild anyway
    read -p "Rebuild and restart anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Update cancelled"
        exit 0
    fi
else
    log_success "Updated from $BEFORE_COMMIT to $AFTER_COMMIT"

    # Show what changed
    log_info "Changes:"
    git log --oneline "$BEFORE_COMMIT".."$AFTER_COMMIT"
    echo ""
fi

# ============================================
# Validate Configuration
# ============================================

log_info "Validating Docker Compose configuration..."
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
    log_error "Docker Compose configuration is invalid"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config
    exit 1
fi
log_success "Configuration is valid"
echo ""

# ============================================
# Rebuild Docker Image
# ============================================

log_info "Rebuilding Docker image with latest code..."
log_warning "This may take several minutes..."

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache; then
    log_error "Docker build failed"
    log_error "Rolling back git changes..."
    git reset --hard "$BEFORE_COMMIT"
    exit 1
fi

log_success "Docker image rebuilt successfully"
echo ""

# ============================================
# Update Container
# ============================================

log_info "Updating container..."

# Stop old container and start new one
# Using 'up -d' will recreate the container if the image changed
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d; then
    log_error "Failed to update container"
    exit 1
fi

log_success "Container updated"
echo ""

# ============================================
# Show Container Status
# ============================================

log_info "Container status:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
echo ""

# ============================================
# Health Check
# ============================================

log_info "Waiting for application to be healthy..."
log_info "Health endpoint: $HEALTH_ENDPOINT"

RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_HEALTH_RETRIES ]; do
    if curl -sf "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
        log_success "Health check passed!"
        echo ""

        # Show health response
        log_info "Health check response:"
        curl -s "$HEALTH_ENDPOINT" | jq '.' 2>/dev/null || curl -s "$HEALTH_ENDPOINT"
        echo ""

        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))

    if [ $RETRY_COUNT -eq $MAX_HEALTH_RETRIES ]; then
        log_error "Health check failed after $MAX_HEALTH_RETRIES attempts"
        log_error "New version may not be healthy. Check logs:"
        log_error "  docker compose -f $COMPOSE_FILE logs"
        log_warning "Consider rolling back to previous version:"
        log_warning "  git reset --hard $BEFORE_COMMIT"
        log_warning "  ./deploy-production.sh"
        exit 1
    fi

    echo -n "."
    sleep $HEALTH_RETRY_DELAY
done

# ============================================
# Cleanup Old Images
# ============================================

log_info "Cleaning up old Docker images..."
docker image prune -f --filter "label=com.docker.compose.project=admin-tickets" > /dev/null 2>&1 || true
log_success "Cleanup complete"
echo ""

# ============================================
# Final Status
# ============================================

log_success "======================================"
log_success "UPDATE COMPLETED SUCCESSFULLY"
log_success "======================================"
echo ""
log_info "Service: Ticketing Admin"
log_info "Domain: https://ticketing.intuspath.com"
log_info "Updated: $BEFORE_COMMIT → $AFTER_COMMIT"
log_info "Container: $CONTAINER_NAME"
echo ""
log_info "Useful commands:"
log_info "  View logs:    docker compose -f $COMPOSE_FILE logs -f"
log_info "  Rollback:     git reset --hard $BEFORE_COMMIT && ./deploy-production.sh"
echo ""
