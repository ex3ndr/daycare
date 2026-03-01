# Daycare App Server

Core API server for the Daycare app. Handles authentication, prompt file management, active task listing, and `/app` access links.

## Settings

Configure under top-level `settings.appServer`:

- `enabled`: enable/disable app server runtime (`false` by default)
- `host`: bind host, default `127.0.0.1`
- `port`: bind port, default `7332`
- `appEndpoint`: app endpoint URL where generated links open, default `https://daycare.dev`
- `serverEndpoint` (optional): backend endpoint URL embedded in hash payload (for example `https://api.example.com`)
- `jwtSecret` (optional): shared seed override; when omitted, uses auth store key `seed`
- `telegramInstanceId` (optional): preferred Telegram plugin instance id for WebApp auth (defaults to first enabled `telegram` plugin, or `telegram`)

Notes:
- `appEndpoint` and `serverEndpoint` must be full `http(s)` endpoint URLs.
- Trailing slashes are removed automatically.
- Paths/query/hash are not allowed.

## Routes

### Auth
- `POST /auth/validate`: validate session tokens and exchange link tokens to 1-year session tokens
- `POST /auth/refresh`: validate token and return a fresh 1-year session token
- `POST /auth/telegram`: verify Telegram WebApp `initData` and issue a 1-year session token

### Prompts (authenticated via `Authorization: Bearer <token>`)
- `GET /prompts`: list available prompt files
- `GET /prompts/:filename`: read prompt file content (falls back to bundled default)
- `PUT /prompts/:filename`: update prompt file content (`{ "content": "..." }`)

### Tasks (authenticated via `Authorization: Bearer <token>`)
- `GET /tasks/active`: list active tasks with cron/webhook triggers and last execution timestamps

Allowed filenames: `SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`

### Other
- `GET /`: welcome message
- `POST /v1/webhooks/:token`: trigger a task webhook by signed token (unauthenticated)

## Tool and command

- Tool: `app_auth_link`
- Slash command: `/app`

Both generate a short-lived app URL in the form:
`<appEndpoint-or-serverEndpoint>/auth#<base64url-json>`

Token lifecycle:
- Link token (ephemeral): embedded in `/auth#...` URL payload, default TTL is 1 hour.
- Session token (long-term): returned by `/auth/validate`, `/auth/refresh`, and `/auth/telegram`, TTL is 1 year.

## Structure

```
appServer.ts        — server lifecycle and route wiring
appServerSettingsResolve.ts — settings defaults and validation
appHttp.ts          — HTTP utilities (CORS, JSON, body parsing, listen/close)
appAuthExtract.ts   — JWT Bearer token extraction
appAuthLinkTool.ts  — magic link generation tool
appTelegramInitDataValidate.ts — Telegram WebApp initData signature validation
appJwtSecretResolve.ts — JWT secret resolution
appEndpointNormalize.ts — endpoint URL validation
routes/
  routeAuthValidate.ts  — POST /auth/validate
  routeAuthRefresh.ts   — POST /auth/refresh
  routeAuthTelegram.ts  — POST /auth/telegram
  routeWebhookTrigger.ts — POST /v1/webhooks/:token
```

Shared authenticated API handlers live in `sources/api/routes/`.
