# Upgrade plugin

## Overview
Adds a user slash command `/upgrade` for runtime upgrades.

The command runs:
1. `npm install -g daycare-cli`
2. `pm2 restart <processName>`

## Settings
- `strategy` (required): currently only `"pm2"`.
- `processName` (required): PM2 process name to restart after install.

## Onboarding
- On add, the plugin runs `pm2 jlist` and looks for an **online** PM2 process named `daycare`.
- If `daycare` is not online (or PM2 is unavailable), onboarding aborts and the plugin is not added.
- If detected, onboarding stores:
  - `strategy: "pm2"`
  - `processName: "daycare"`

## Slash command
- `/upgrade` - upgrades Daycare CLI and restarts the configured PM2 process.

## Notes
- Slash commands are user-facing and are not exposed as model tools.
- The plugin sends progress/failure status messages back to the invoking channel.
