#!/bin/bash

# Script to switch OpenCode between Free and OmniRoute models
# Usage: ./scripts/opencode-switch.sh [free|omni]

CONFIG_FILE="$HOME/.config/opencode/opencode.json"
BACKUP_FILE="$HOME/.config/opencode/opencode.json.backup"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Show current model
show_current() {
    echo -e "\n${YELLOW}Current OpenCode Model:${NC}"
    grep -o '"model": "[^"]*"' "$CONFIG_FILE" | head -1
}

# Switch to OpenCode Free
switch_free() {
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}✗ No backup found. Run setup-opencode-omni.sh first.${NC}"
        exit 1
    fi
    cp "$BACKUP_FILE" "$CONFIG_FILE"
    echo -e "${GREEN}✓ Switched to OpenCode Free models${NC}"
}

# Switch to OmniRoute
switch_omni() {
    if [ ! -f "$BACKUP_FILE" ]; then
        cp "$CONFIG_FILE" "$BACKUP_FILE"
    fi
    
    # Update model to use OmniRoute
    sed -i '' 's|"model": "opencode/deepseek-v4-flash-free"|"model": "omniroute/auto"|' "$CONFIG_FILE"
    sed -i '' 's|"small_model": "opencode/mimo-v2.5-free"|"small_model": "omniroute/auto/fast"|' "$CONFIG_FILE"
    sed -i '' 's|"model": "opencode/mimo-v2.5-free"|"model": "omniroute/auto/fast"|g' "$CONFIG_FILE"
    
    echo -e "${GREEN}✓ Switched to OmniRoute models${NC}"
}

# Main
case "$1" in
    free)
        switch_free
        ;;
    omni)
        switch_omni
        ;;
    current|status)
        show_current
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 [free|omni|current]${NC}"
        echo ""
        echo "Modes:"
        echo "  free    - Use OpenCode Free cloud models"
        echo "  omni    - Use OmniRoute (multi-provider gateway)"
        echo "  current - Show current configuration"
        show_current
        ;;
esac

# Show restart instructions
if [ "$1" = "free" ] || [ "$1" = "omni" ]; then
    echo -e "\n${YELLOW}Restart OpenCode to apply changes:${NC}"
    echo "  exit && opencode"
fi
