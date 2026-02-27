# Telegram WebApp Authentication

This change adds Telegram WebApp authentication support across:

- `packages/daycare/sources/plugins/daycare-app-server`
- `packages/daycare/sources/plugins/telegram`
- `packages/daycare-app/sources/modules/auth` and auth screen routing

## What changed

- Added `POST /auth/telegram` in app-server plugin:
  - Validates Telegram WebApp `initData` signature using the Telegram bot token.
  - Checks `auth_date` freshness.
  - Issues standard Daycare JWT for the resolved Telegram user id.
- Added Telegram auth exchange flow in app frontend:
  - Reads `backend` and `telegramInstanceId` from URL query params.
  - Reads `Telegram.WebApp.initData` from WebApp runtime.
  - Exchanges `initData` via `/auth/telegram`, then logs in with returned token.
- Added Telegram bot menu WebApp integration:
  - When `daycare-app-server` is enabled, Telegram connector sets chat menu button to `web_app`.
  - URL points to `/auth` with query params needed by the app (`backend`, `telegramInstanceId`).
  - Without app-server, menu button remains default commands mode.

```mermaid
sequenceDiagram
    participant U as Telegram User
    participant T as Telegram Bot
    participant A as Daycare App (WebApp)
    participant S as daycare-app-server

    U->>T: Open bot menu button (web_app)
    T-->>A: Launch /auth?backend=...&telegramInstanceId=...
    A->>A: Read Telegram.WebApp.initData
    A->>S: POST /auth/telegram { initData, telegramInstanceId }
    S->>S: Resolve telegram bot token
    S->>S: Verify initData HMAC + auth_date
    S->>S: Sign Daycare JWT for telegram user id
    S-->>A: { ok: true, token, userId, expiresAt }
    A->>S: POST /auth/validate { token }
    S-->>A: { ok: true, userId }
    A-->>U: Authenticated app session
```
