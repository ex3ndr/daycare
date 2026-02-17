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

## Slash commands
- `/upgrade` - upgrades Daycare CLI and restarts the configured PM2 process.
  - Persists the requester and the pre-upgrade Daycare version before restart.
  - PM2 restart errors are reported but ignored.
  - On next process boot, plugin `postStart()` compares previous/current versions and sends completion only when the version actually changed.
- `/restart` - restarts the configured PM2 process without running the upgrade install step.
  - The command writes a pending marker before `pm2 restart`.
  - If PM2 returns an error, the plugin probes `pm2 jlist` before failing; if restart indicators changed (pid/uptime/restart count), the command is treated as successful.
  - On next process boot, plugin `postStart()` checks the marker (pid/time heuristic) and sends restart completion status.

## Notes
- Slash commands are user-facing and are not exposed as model tools.
- The plugin sends progress/failure status messages back to the invoking channel.
