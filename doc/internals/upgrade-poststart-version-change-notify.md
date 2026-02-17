# Upgrade PostStart Version-Change Notify

The upgrade flow now confirms completion based on a version delta observed after process boot, not on `pm2 restart` command success alone.

## Behavior
- `/upgrade` saves pending metadata with:
  - requester descriptor/context
  - request timestamp/pid
  - pre-upgrade Daycare version
- Restart command errors from `/upgrade` are ignored only if PM2 process snapshots show a successful restart.
- In `postStart()`, the plugin reads pending metadata and compares `previousVersion` vs current version.
- It sends an upgrade completion message only when versions differ.
- The pending marker is a single file, so the most recent requester is always the notification target.

## Flow
```mermaid
flowchart TD
  A[/upgrade invoked/] --> B[Read current Daycare version]
  B --> C[Write restart-pending.json with descriptor+context+previousVersion]
  C --> D[npm install -g daycare-cli]
  D --> E[pm2 restart daycare]
  E -->|error| F[Report restart error but continue]
  E -->|ok| G[Process restart]
  F --> G
  G --> H[plugin.postStart()]
  H --> I[Read and clear restart-pending.json]
  I --> J{same pid OR marker stale?}
  J -->|yes| K[Exit]
  J -->|no| L{previousVersion != currentVersion?}
  L -->|no| K
  L -->|yes| M[Send upgrade completion to most recent requester]
```
