# Upgrade plugin

## Overview
Provides upgrade and restart capabilities for Daycare runtime.

## Commands
- `/upgrade` - Upgrades Daycare CLI and restarts the PM2 process
- `/restart` - Restarts the PM2 process without upgrading

## Tool
- `self_upgrade` - Programmatic upgrade tool for agents

### self_upgrade Tool

Allows the agent to upgrade Daycare to a newer version.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version` | string | No | Specific version to install (e.g. '2026.2.1'). If omitted, installs latest. |

**Constraints:**
- Only available in foreground sessions (direct user chat)
- Not available in background agents, subagents, or group chats
- After upgrade, the process restarts and agent context is reset

**Example usage by agent:**
```
self_upgrade()                    # Upgrade to latest
self_upgrade(version="2026.2.1")  # Upgrade to specific version
```

**Response:**
```json
{
  "success": true,
  "message": "Upgrade to latest initiated. The process is restarting.",
  "previousVersion": "2026.2.0",
  "requestedVersion": "latest"
}
```

## Settings
- `strategy` (required): currently only `"pm2"`.
- `processName` (required): PM2 process name to restart after install.

## Onboarding
- On add, the plugin runs `pm2 jlist` and looks for an **online** PM2 process named `daycare`.
- If `daycare` is not online (or PM2 is unavailable), onboarding aborts and the plugin is not added.
- If detected, onboarding stores:
  - `strategy: "pm2"`
  - `processName: "daycare"`

## How it works

### Upgrade flow
1. Runs `npm install -g daycare-cli` (or `daycare-cli@<version>`)
2. Runs `pm2 restart <processName>`
3. Persists the requester and pre-upgrade version before restart
4. On next boot, compares versions and sends completion message

### Restart flow
1. Runs `pm2 restart <processName>`
2. Persists a restart marker
3. On next boot, sends restart completion status

## Notes
- Commands (`/upgrade`, `/restart`) are user-facing slash commands
- The `self_upgrade` tool is available to the model in foreground sessions
- Progress/failure status messages are sent back to the invoking channel