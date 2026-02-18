# Dashboard Plugin

The `dashboard` plugin runs a local dashboard server fully inside `daycare-cli`.

It serves bundled static assets and proxies `/api/*` requests to the engine unix socket.

The bundled static assets are produced from `packages/daycare-dashboard` via Next static export during `daycare-cli` build/publish.

## Runtime flow

```mermaid
flowchart LR
  Browser[Browser] --> Dashboard[Dashboard plugin HTTP server]
  Dashboard -->|Static files| UI[Bundled dashboard site]
  UI -->|/api/*| Dashboard
  Dashboard -->|unix socket proxy| Engine[Daycare engine server]
```

## API prefix rewrite

The dashboard frontend calls `/api/v1/*`, while the engine socket server exposes `/v1/*`.
The proxy rewrites only the leading `/api` prefix before forwarding upstream.

```mermaid
sequenceDiagram
  participant Browser
  participant Dashboard as Dashboard plugin
  participant Engine

  Browser->>Dashboard: GET /api/v1/engine/heartbeat/tasks
  Dashboard->>Dashboard: rewrite path /api/v1/... -> /v1/...
  Dashboard->>Engine: GET /v1/engine/heartbeat/tasks
  Engine-->>Dashboard: 200 JSON
  Dashboard-->>Browser: 200 JSON
```

## Authentication flow

If `basicAuth` is configured in plugin settings, every dashboard request requires HTTP Basic auth.

```mermaid
sequenceDiagram
  participant Client
  participant Server as Dashboard plugin
  participant Engine

  Client->>Server: GET / + Authorization: Basic ...
  Server->>Server: verify username + bcrypt password hash
  alt valid credentials
    Server-->>Client: 200 static asset
    Client->>Server: GET /api/v1/engine/status
    Server->>Engine: proxy request over daycare.sock
    Engine-->>Server: status payload
    Server-->>Client: proxied response
  else invalid credentials
    Server-->>Client: 401 + WWW-Authenticate
  end
```

## Onboarding

`daycare add` -> `Plugin` -> `Dashboard` onboarding prompts for:
- host
- port
- whether basic auth should be enabled
- generated secure password or user-provided strong password

The plugin stores only a bcrypt password hash in plugin settings.
