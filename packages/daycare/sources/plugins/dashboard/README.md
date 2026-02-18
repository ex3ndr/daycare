# Dashboard Plugin

Runs a local Daycare dashboard server directly inside the Daycare runtime.

## Settings
- `host`: bind host (default `127.0.0.1`)
- `port`: bind port (default `7331`)
- `basicAuth` (optional): enables HTTP Basic auth when present
  - `username`: login username
  - `passwordHash`: bcrypt hash of the login password

## Onboarding
- Prompts for host and port.
- Prompts whether to enable basic auth.
- If basic auth is enabled, onboarding supports:
  - generating a secure random password, or
  - providing a custom strong password (12+ chars, upper/lower/digit).
- Stores only the bcrypt hash in plugin settings.

## Runtime behavior
- Serves bundled static dashboard assets from the plugin package.
- Proxies `/api/*` requests to the local Daycare engine unix socket.
- Uses streaming proxy behavior so SSE endpoints (for example `/api/v1/engine/events`) continue working.
- Shuts down the HTTP server when the plugin unloads.
