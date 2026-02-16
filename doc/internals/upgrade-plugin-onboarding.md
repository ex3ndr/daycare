# Upgrade Plugin Onboarding

The Upgrade plugin now has onboarding that auto-detects PM2 readiness before enabling the plugin.

## Behavior
- On plugin add, onboarding runs `pm2 jlist`.
- It requires an **online** PM2 process named `daycare`.
- If missing/unavailable, onboarding returns `null`, so `daycare add` cancels and does not write the plugin into settings.
- If found, onboarding writes settings:
  - `strategy: "pm2"`
  - `processName: "daycare"`

## Flow
```mermaid
flowchart TD
  A[daycare add -> upgrade plugin] --> B[upgrade.onboarding]
  B --> C[run pm2 jlist]
  C --> D{online process named daycare?}
  D -->|yes| E[return settings strategy=pm2 processName=daycare]
  D -->|no| F[api.note failure reason]
  F --> G[return null]
  G --> H[add command cancels plugin add]
```
