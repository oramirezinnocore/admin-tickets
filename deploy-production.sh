#!/bin/bash

# ============================================
# TICKETING ADMIN - PRODUCTION DEPLOYMENT SCRIPT
# ============================================
# Deploys Ticketing Admin to production using Docker Compose V2
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

log_info "Starting Ticketing Admin production deployment..."
echo ""

# Check if .env.production exists
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env.production file not found!"
    log_error "Please create .env.production based on .env.production.example"
    exit 1
fi
log_success ".env.production found"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi
log_success "Docker is installed"

# Check if Docker Compose V2 is available
if ! docker compose version &> /dev/null; then
    log_error "Docker Compose V2 is not available"
    log_error "Please install Docker Compose V2 or upgrade Docker Desktop"
    exit 1
fi
log_success "Docker Compose V2 is available"

# Check if required environment variables are set
log_info "Validating environment variables..."
source "$ENV_FILE"

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    log_error "NEXT_PUBLIC_SUPABASE_URL is not set in $ENV_FILE"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    log_error "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in $ENV_FILE"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    log_error "SUPABASE_SERVICE_ROLE_KEY is not set in $ENV_FILE"
    exit 1
fi

log_success "Required environment variables are set"
echo ""

# ============================================
# Validate Docker Compose Configuration
# ============================================

log_info "Validating Docker Compose configuration..."
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
    log_error "Docker Compose configuration is invalid"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config
    exit 1
fi
log_success "Docker Compose configuration is valid"
echo ""

# ============================================
# Build Docker Image
# ============================================

log_info "Building Docker image..."
log_warning "This may take several minutes on first run..."

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --no-cache; then
    log_error "Docker build failed"
    exit 1
fi

log_success "Docker image built successfully"
echo ""

# ============================================
# Stop Existing Container (if running)
# ============================================

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_info "Stopping existing container..."
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down
    log_success "Existing container stopped"
    echo ""
fi

# ============================================
# Start Container
# ============================================

log_info "Starting Ticketing Admin container..."
if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d; then
    log_error "Failed to start container"
    exit 1
fi

log_success "Container started"
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
        log_error "Container may not be healthy. Check logs:"
        log_error "  docker compose -f $COMPOSE_FILE logs"
        exit 1
    fi

    echo -n "."
    sleep $HEALTH_RETRY_DELAY
done

# ============================================
# Final Status
# ============================================

log_success "======================================"
log_success "DEPLOYMENT COMPLETED SUCCESSFULLY"
log_success "======================================"
echo ""
log_info "Service: Ticketing Admin"
log_info "Domain: https://ticketing.intuspath.com"
log_info "Local: http://localhost:3004"
log_info "Container: $CONTAINER_NAME"
echo ""
log_info "Useful commands:"
log_info "  View logs:    docker compose -f $COMPOSE_FILE logs -f"
log_info "  Stop:         docker compose -f $COMPOSE_FILE down"
log_info "  Restart:      docker compose -f $COMPOSE_FILE restart"
log_info "  Status:       docker compose -f $COMPOSE_FILE ps"
echo ""
