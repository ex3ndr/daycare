# Daycare App Server Plugin

Pure API server for the Daycare app. Handles authentication, prompt file management, and provides `/app` access links.

## Settings

- `host`: bind host, default `127.0.0.1`
- `port`: bind port, default `7332`
- `appEndpoint`: app endpoint URL where generated links open, default `https://daycare.dev`
- `serverEndpoint` (optional): backend endpoint URL embedded in hash payload (for example `https://api.example.com`)
- `jwtSecret` (optional): HS256 JWT signing secret; when omitted, plugin uses auth store key `app-auth.jwtSecret`
- `telegramInstanceId` (optional): preferred Telegram plugin instance id for WebApp auth (defaults to first enabled `telegram` plugin, or `telegram`)

Notes:
- `appEndpoint` and `serverEndpoint` must be full `http(s)` endpoint URLs.
- Trailing slashes are removed automatically.
- Paths/query/hash are not allowed.

## Routes

### Auth
- `POST /auth/validate`: validate incoming magic link token
- `POST /auth/refresh`: validate token and return a fresh 1-hour token
- `POST /auth/telegram`: verify Telegram WebApp `initData` and exchange it for a Daycare auth token

### Prompts (authenticated via `Authorization: Bearer <token>`)
- `GET /prompts`: list available prompt files
- `GET /prompts/:filename`: read prompt file content (falls back to bundled default)
- `PUT /prompts/:filename`: update prompt file content (`{ "content": "..." }`)

Allowed filenames: `SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`

### Other
- `GET /`: welcome message
- `POST /v1/webhooks/:id`: trigger a task webhook by id (unauthenticated; id acts as secret)

## Tool and command

- Tool: `app_auth_link`
- Slash command: `/app`

Both generate a short-lived app URL in the form:
`<appEndpoint-or-serverEndpoint>/auth#<base64url-json>`

## Structure

```
plugin.ts           — server lifecycle and route wiring
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
```

Prompt API handlers live in `sources/api/prompts/` (shared across the codebase).
