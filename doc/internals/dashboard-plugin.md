# Dashboard Plugin

The `dashboard` plugin runs a local dashboard server fully inside `daycare-cli`.

It serves bundled static assets and proxies `/api/*` requests to the engine unix socket.

## Runtime flow

```mermaid
flowchart LR
  Browser[Browser] --> Dashboard[Dashboard plugin HTTP server]
  Dashboard -->|Static files| UI[Bundled dashboard site]
  UI -->|/api/*| Dashboard
  Dashboard -->|unix socket proxy| Engine[Daycare engine server]
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
