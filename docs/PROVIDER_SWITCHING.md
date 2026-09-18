# AI Provider Switching

Easily switch between different AI providers without editing files.

## Usage

```bash
# Switch to NARA (primary)
./scripts/switch-provider.sh nara

# Switch to Groq
./scripts/switch-provider.sh groq

# Switch to OmniRoute (multi-provider gateway)
./scripts/switch-provider.sh omni

# Switch to Local (offline mode)
./scripts/switch-provider.sh local

# Show current provider
./scripts/switch-provider.sh current

# Restore previous configuration
./scripts/switch-provider.sh restore
```

## After Switching

Restart the server to apply changes:

```bash
lsof -ti:3780 | xargs kill -9
npm run dev
```

## Provider Details

| Provider | Quality | Speed | Cost | Notes |
|----------|---------|-------|------|-------|
| NARA | 82-92/100 | Medium | Free tier | Primary choice |
| Groq | Good | Fast | Free tier | Fallback |
| OmniRoute | Varies | Varies | Varies | Multi-provider gateway |
| Local | 60-70/100 | Instant | Free | Offline mode |

## OmniRoute Setup

1. Make sure OmniRoute is running: `omniroute`
2. Switch to OmniRoute: `./scripts/switch-provider.sh omni`
3. Restart the dev server

## Backup

The script automatically backs up your `.env` file before switching. To restore:

```bash
./scripts/switch-provider.sh restore
```
