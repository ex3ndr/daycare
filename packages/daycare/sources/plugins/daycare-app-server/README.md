# Daycare App Server Plugin

Serves the Daycare Expo web build, exposes token auth endpoints, and provides `/app` access links.

## Settings

- `host`: bind host, default `127.0.0.1`
- `port`: bind port, default `7332`
- `appDomain` (optional): domain or URL where generated links open (for example `app.example.com` or `https://app.example.com`)
- `serverDomain` (optional): domain or URL embedded as backend target in hash payload (for example `api.example.com` or `https://api.example.com`)
- `jwtSecret` (optional): HS256 JWT signing secret; when omitted, plugin uses auth store key `app-auth.jwtSecret`

## Routes

- `POST /auth/validate`: validate incoming magic link token
- `POST /auth/refresh`: validate token and return a fresh 1-hour token
- `/api/*`: proxied to local engine IPC socket
- `/*`: static SPA assets from `packages/daycare-app/dist` or `packages/daycare-app/web-build`

## Tool and command

- Tool: `app_auth_link`
- Slash command: `/app`

Both generate a short-lived app URL in the form:
`http://<host>:<port>/auth#<base64url-json>`

When `appDomain` is configured, links open on that app domain.
When `serverDomain` is configured, the payload `backendUrl` points to that server domain.
If only `serverDomain` is set, links also open on `serverDomain`.

Hash payload JSON shape:

```json
{
    "backendUrl": "http://<host>:<port>",
    "token": "<jwt>"
}
```

Token signing/verifying is implemented with `privacy-kit` ephemeral tokens.

## Terminal generation

You can also generate links directly from CLI:

```bash
daycare app-link <userId>
```
