# Daycare App Split-Endpoint Link Generation

The `daycare-app-server` plugin supports separate link endpoints for `/app` and `app_auth_link` URL generation.

- Server bind still uses `host` + `port`.
- Generated link host uses `appEndpoint` endpoint (default `https://daycare.dev`) when `serverEndpoint` is not set.
- Hash payload `backendUrl` uses `serverEndpoint` endpoint when present.
- Endpoints must be full `http(s)` URLs. Trailing slashes are trimmed.

```mermaid
flowchart LR
    Settings[Plugin settings] --> Bind[host + port for server listen]
    Settings --> AppEndpoint{appEndpoint set?}
    Settings --> ServerEndpoint{serverEndpoint set?}
    AppEndpoint -->|yes| LinkURL[appEndpoint/auth#...]
    AppEndpoint -->|no + serverEndpoint yes| LinkURLServer[serverEndpoint/auth#...]
    AppEndpoint -->|no + serverEndpoint no| LinkURLDefault[https://daycare.dev/auth#...]
    ServerEndpoint -->|yes| BackendURL[serverEndpoint]
    ServerEndpoint -->|no| BackendFallback[link URL origin]
    LinkURL --> Hash[hash payload backendUrl]
    LinkURLServer --> Hash
    LinkURLDefault --> Hash
    BackendURL --> Hash
    BackendFallback --> Hash
```
