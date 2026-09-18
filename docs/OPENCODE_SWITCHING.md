# OpenCode CLI Model Switching

Switch between OpenCode Free cloud models and OmniRoute (multi-provider gateway).

## Quick Start

```bash
# Setup OmniRoute provider in OpenCode
./scripts/setup-opencode-omni.sh

# Switch between models
./scripts/opencode-switch.sh free    # Use OpenCode Free
./scripts/opencode-switch.sh omni    # Use OmniRoute
./scripts/opencode-switch.sh current # Show current model
```

## After Switching

Restart OpenCode to apply changes:
```bash
exit && opencode
```

## Available Models

### OpenCode Free
- `opencode/deepseek-v4-flash-free` - Default model
- `opencode/mimo-v2.5-free` - Small model

### OmniRoute
- `omniroute/auto` - Smart routing (balanced)
- `omniroute/auto/coding` - Optimized for code
- `omniroute/auto/fast` - Lowest latency
- `omniroute/auto/cheap` - Cheapest per token

## Switching in OpenCode CLI

Once inside OpenCode, you can switch models:
```
/model omniroute/auto
/model omniroute/auto/coding
/model opencode/deepseek-v4-flash-free
```

## Restore Original Config

```bash
cp ~/.config/opencode/opencode.json.backup ~/.config/opencode/opencode.json
```

## Requirements

1. OmniRoute must be running: `omniroute`
2. At least one provider configured in OmniRoute
