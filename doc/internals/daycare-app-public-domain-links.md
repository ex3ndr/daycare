# Daycare App Split-Domain Link Generation

The `daycare-app-server` plugin supports separate link endpoints for `/app` and `app_auth_link` URL generation.

- Server bind still uses `host` + `port`.
- Generated link host uses `appEndpoint` endpoint (default `https://daycare.dev`) when `serverDomain` is not set.
- Hash payload `backendUrl` uses `serverDomain` endpoint when present.
- Endpoints must be full `http(s)` URLs. Trailing slashes are trimmed.

```mermaid
flowchart LR
    Settings[Plugin settings] --> Bind[host + port for server listen]
    Settings --> AppEndpoint{appEndpoint set?}
    Settings --> ServerDomain{serverDomain set?}
    AppEndpoint -->|yes| LinkURL[appEndpoint/auth#...]
    AppEndpoint -->|no + serverDomain yes| LinkURLServer[serverDomain/auth#...]
    AppEndpoint -->|no + serverDomain no| LinkURLDefault[https://daycare.dev/auth#...]
    ServerDomain -->|yes| BackendURL[serverDomain]
    ServerDomain -->|no| BackendFallback[link URL origin]
    LinkURL --> Hash[hash payload backendUrl]
    LinkURLServer --> Hash
    LinkURLDefault --> Hash
    BackendURL --> Hash
    BackendFallback --> Hash
```
