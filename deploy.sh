#!/bin/bash
set -e

# ============================================================
#  Recruitment Tool - One-Click Deployment Script
#  Usage: ./deploy.sh
# ============================================================

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Recruitment Tool - Deployment${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# --- Check prerequisites ---
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed.${NC}"
    echo "Install Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: docker compose plugin is not installed.${NC}"
    echo "Install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}  Docker & Docker Compose OK${NC}"

# --- Check .env file ---
echo -e "${YELLOW}[2/5] Checking configuration...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo ""
    echo "Please create it first:"
    echo -e "  ${CYAN}cp .env.example .env${NC}"
    echo "  Then edit .env and set your DOMAIN and JWT_SECRET"
    exit 1
fi

# Source .env
export $(grep -v '^#' .env | xargs)

if [ "$DOMAIN" = "your-domain.com" ] || [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: DOMAIN is not set in .env${NC}"
    echo "Please edit .env and set your domain name"
    exit 1
fi

if [ "$JWT_SECRET" = "change-this-to-a-random-secret-key" ] || [ -z "$JWT_SECRET" ]; then
    echo -e "${YELLOW}Warning: JWT_SECRET is still the default value.${NC}"
    echo -e "Generating a secure random secret..."
    JWT_SECRET=$(openssl rand -hex 32)
    # Update .env file
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    echo -e "${GREEN}  JWT_SECRET generated and saved to .env${NC}"
fi

echo -e "${GREEN}  Domain: $DOMAIN${NC}"
echo -e "${GREEN}  JWT Secret: (hidden)${NC}"

# --- Check DNS ---
echo -e "${YELLOW}[3/5] Checking DNS resolution...${NC}"

if [ "$DOMAIN" != "localhost" ]; then
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
    DOMAIN_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1 || echo "unknown")

    if [ "$DOMAIN_IP" = "unknown" ]; then
        echo -e "${YELLOW}  Warning: Could not resolve DNS for $DOMAIN${NC}"
        echo -e "  Make sure your domain points to: $SERVER_IP"
    elif [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
        echo -e "${YELLOW}  Warning: Domain IP ($DOMAIN_IP) != Server IP ($SERVER_IP)${NC}"
        echo -e "  SSL certificate may fail. Make sure DNS is configured correctly."
    else
        echo -e "${GREEN}  DNS OK: $DOMAIN -> $DOMAIN_IP${NC}"
    fi
else
    echo -e "${YELLOW}  Running in localhost mode (no SSL)${NC}"
fi

# --- Build and start ---
echo -e "${YELLOW}[4/5] Building Docker images...${NC}"
echo "This may take a few minutes on first run..."
echo ""

docker compose build

echo ""
echo -e "${YELLOW}[5/5] Starting services...${NC}"

docker compose up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Frontend:  ${CYAN}https://$DOMAIN${NC}"
echo -e "API Health:${CYAN}https://$DOMAIN/api/health${NC}"
echo ""
echo -e "Default login: ${CYAN}admin / admin123${NC}"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "  - SSL certificate is obtained automatically (may take ~30s on first run)"
echo "  - To view logs:   docker compose logs -f"
echo "  - To stop:        docker compose down"
echo "  - To rebuild:     docker compose up -d --build"
echo ""
