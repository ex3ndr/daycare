# Upgrade plugin

## Overview
Adds a user slash command `/upgrade` for runtime upgrades.

The command runs:
1. `npm install -g daycare-cli`
2. `pm2 restart <processName>`

## Settings
- `strategy` (required): currently only `"pm2"`.
- `processName` (required): PM2 process name to restart after install.

## Slash command
- `/upgrade` - upgrades Daycare CLI and restarts the configured PM2 process.

## Notes
- Slash commands are user-facing and are not exposed as model tools.
- The plugin sends progress/failure status messages back to the invoking channel.
