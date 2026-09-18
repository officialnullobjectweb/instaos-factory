#!/bin/bash

# Script to configure OpenCode CLI to use OmniRoute
# Usage: ./scripts/setup-opencode-omni.sh

CONFIG_FILE="$HOME/.config/opencode/opencode.json"
BACKUP_FILE="$HOME/.config/opencode/opencode.json.backup"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Setting up OpenCode CLI with OmniRoute...${NC}"

# Backup current config
if [ -f "$CONFIG_FILE" ]; then
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backed up current config${NC}"
fi

# Check if OmniRoute is running
if ! curl -s http://localhost:20128/ > /dev/null 2>&1; then
    echo -e "${RED}✗ OmniRoute is not running on localhost:20128${NC}"
    echo "Start OmniRoute first: omniroute"
    exit 1
fi

echo -e "${GREEN}✓ OmniRoute is running${NC}"

# Create updated config
cat > "$CONFIG_FILE" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/deepseek-v4-flash-free",
  "small_model": "opencode/mimo-v2.5-free",
  "plugin": [
    "@dietrichgebert/ponytail"
  ],
  "agent": {
    "compaction": {
      "model": "opencode/mimo-v2.5-free"
    },
    "title": {
      "model": "opencode/mimo-v2.5-free"
    },
    "summary": {
      "model": "opencode/mimo-v2.5-free"
    }
  },
  "mcp": {
    "thinking": {
      "type": "local",
      "enabled": true,
      "command": [
        "npx",
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    },
    "github": {
      "type": "remote",
      "enabled": true,
      "url": "https://api.githubcopilot.com/mcp/",
      "oauth": false,
      "headers": {
        "Authorization": "Bearer $GITHUB_TOKEN",
        "User-Agent": "opencode-mcp"
      }
    },
    "agent-browser": {
      "type": "local",
      "enabled": true,
      "command": [
        "node",
        "/Users/karandhiver/.opencode/mcp-server-agent-browser.js"
      ]
    }
  },
  "disabled_providers": [],
  "provider": {
    "omniroute": {
      "name": "OmniRoute",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "http://localhost:20128/v1"
      },
      "models": {
        "auto": {
          "name": "Auto (Smart Routing)"
        },
        "auto/coding": {
          "name": "Auto Coding"
        },
        "auto/fast": {
          "name": "Auto Fast"
        },
        "auto/cheap": {
          "name": "Auto Cheap"
        }
      }
    },
    "kamal": {
      "name": "Claude",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://router.bynara.id/v1"
      },
      "models": {
        "FABLE 5": {
          "name": "claude"
        },
        "qwen3.8-flash-free": {
          "name": "Qwen"
        },
        "glm-5.3-free": {
          "name": "GML"
        }
      }
    }
  }
}
EOF

echo -e "${GREEN}✓ Updated OpenCode config with OmniRoute provider${NC}"
echo ""
echo -e "${YELLOW}How to use:${NC}"
echo "1. Start OpenCode: opencode"
echo "2. Switch model: /model omniroute/auto"
echo "3. Or use specific model: /model omniroute/auto/coding"
echo ""
echo -e "${YELLOW}Available OmniRoute models:${NC}"
echo "  auto          - Smart routing (balanced)"
echo "  auto/coding   - Optimized for code generation"
echo "  auto/fast     - Lowest latency"
echo "  auto/cheap    - Cheapest per token"
echo ""
echo -e "${GREEN}To restore original config:${NC}"
echo "  cp ~/.config/opencode/opencode.json.backup ~/.config/opencode/opencode.json"
