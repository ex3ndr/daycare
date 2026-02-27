# Daycare App Server Plugin

Serves the Daycare Expo web build, exposes token auth endpoints, and provides `/app` access links.

## Settings

- `host`: bind host, default `127.0.0.1`
- `port`: bind port, default `7332`
- `appEndpoint`: app endpoint URL where generated links open, default `https://daycare.dev`
- `serverEndpoint` (optional): backend endpoint URL embedded in hash payload (for example `https://api.example.com`)
- `jwtSecret` (optional): HS256 JWT signing secret; when omitted, plugin uses auth store key `app-auth.jwtSecret`

Notes:
- `appEndpoint` and `serverEndpoint` must be full `http(s)` endpoint URLs.
- Trailing slashes are removed automatically.
- Paths/query/hash are not allowed.

## Routes

- `GET /`: plain welcome message (`Welcome to Daycare App API!`)
- `POST /auth/validate`: validate incoming magic link token
- `POST /auth/refresh`: validate token and return a fresh 1-hour token
- `/api/*`: proxied to local engine IPC socket
- `/<path>` (non-root): static SPA assets from `packages/daycare-app/dist` or `packages/daycare-app/web-build`

## Tool and command

- Tool: `app_auth_link`
- Slash command: `/app`

Both generate a short-lived app URL in the form:
`<appEndpoint-or-serverEndpoint>/auth#<base64url-json>`

When `appEndpoint` is configured, links open on that app endpoint.
When `serverEndpoint` is configured, the payload `backendUrl` points to that server endpoint.
If only `serverEndpoint` is set, links also open on `serverEndpoint`.

Hash payload JSON shape:

```json
{
    "backendUrl": "<serverEndpoint-or-link-origin>",
    "token": "<jwt>"
}
```

Token signing/verifying is implemented with `privacy-kit` ephemeral tokens.

## Terminal generation

You can also generate links directly from CLI:

```bash
daycare app-link <userId>
```
