# Daycare App Server Plugin

Serves the Daycare Expo web build, exposes token auth endpoints, and provides `/app` access links.

## Settings

- `host`: bind host, default `127.0.0.1`
- `port`: bind port, default `7332`
- `publicDomain` (optional): public hostname or URL used in generated `/app` links (for example `app.example.com` or `https://app.example.com`)
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

When `publicDomain` is configured, links use that public domain instead.

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
