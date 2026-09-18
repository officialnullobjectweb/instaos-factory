#!/bin/bash

# Script to switch between AI providers
# Usage: ./scripts/switch-provider.sh [provider]
# Providers: nara, groq, omni, local

ENV_FILE=".env"
BACKUP_FILE=".env.backup"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Backup current .env
backup_env() {
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$BACKUP_FILE"
        echo -e "${GREEN}✓ Backed up .env to .env.backup${NC}"
    fi
}

# Show current provider
show_current() {
    echo -e "\n${YELLOW}Current AI Provider Configuration:${NC}"
    grep -E "^AI_PROVIDER_ORDER=" "$ENV_FILE" 2>/dev/null || echo "Not configured"
}

# Switch to NARA
switch_nara() {
    backup_env
    sed -i '' 's/^AI_PROVIDER_ORDER=.*/AI_PROVIDER_ORDER=nara,groq,local/' "$ENV_FILE"
    echo -e "${GREEN}✓ Switched to NARA (primary) → Groq (fallback) → Local${NC}"
}

# Switch to Groq
switch_groq() {
    backup_env
    sed -i '' 's/^AI_PROVIDER_ORDER=.*/AI_PROVIDER_ORDER=groq,nara,local/' "$ENV_FILE"
    echo -e "${GREEN}✓ Switched to Groq (primary) → NARA (fallback) → Local${NC}"
}

# Switch to OmniRoute
switch_omni() {
    backup_env
    # Add OmniRoute config if not exists
    if ! grep -q "^OMNIROUTE_BASE_URL=" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# OmniRoute Configuration" >> "$ENV_FILE"
        echo "OMNIROUTE_BASE_URL=http://localhost:20128/v1" >> "$ENV_FILE"
        echo "OMNIROUTE_API_KEY=" >> "$ENV_FILE"
    fi
    sed -i '' 's/^AI_PROVIDER_ORDER=.*/AI_PROVIDER_ORDER=omni,nara,groq,local/' "$ENV_FILE"
    echo -e "${GREEN}✓ Switched to OmniRoute (primary) → NARA (fallback) → Groq (fallback) → Local${NC}"
    echo -e "${YELLOW}Note: Make sure OmniRoute is running on localhost:20128${NC}"
}

# Switch to Local (offline)
switch_local() {
    backup_env
    sed -i '' 's/^AI_PROVIDER_ORDER=.*/AI_PROVIDER_ORDER=local/' "$ENV_FILE"
    echo -e "${GREEN}✓ Switched to Local (offline mode)${NC}"
}

# Restore from backup
restore_env() {
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$ENV_FILE"
        echo -e "${GREEN}✓ Restored .env from backup${NC}"
    else
        echo -e "${RED}✗ No backup found${NC}"
    fi
}

# Main
case "$1" in
    nara)
        switch_nara
        ;;
    groq)
        switch_groq
        ;;
    omni)
        switch_omni
        ;;
    local)
        switch_local
        ;;
    restore)
        restore_env
        ;;
    current|status)
        show_current
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 [nara|groq|omni|local|restore|current]${NC}"
        echo ""
        echo "Providers:"
        echo "  nara    - NARA (laguna-s-2.1, 82-92/100 quality)"
        echo "  groq    - Groq (fast, free tier)"
        echo "  omni    - OmniRoute (multi-provider gateway)"
        echo "  local   - Local offline mode"
        echo "  restore - Restore previous .env"
        echo "  current - Show current configuration"
        show_current
        ;;
esac

# Show restart instructions
if [ "$1" = "nara" ] || [ "$1" = "groq" ] || [ "$1" = "omni" ] || [ "$1" = "local" ]; then
    echo -e "\n${YELLOW}Restart the server to apply changes:${NC}"
    echo "  lsof -ti:3780 | xargs kill -9"
    echo "  npm run dev"
fi
