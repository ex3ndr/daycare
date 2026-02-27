# Daycare App Split-Domain Link Generation

The `daycare-app-server` plugin supports separate link endpoints for `/app` and `app_auth_link` URL generation.

- Server bind still uses `host` + `port`.
- Generated link host uses `appDomain` endpoint when present.
- Hash payload `backendUrl` uses `serverDomain` endpoint when present.
- Endpoints must be full `http(s)` URLs. Trailing slashes are trimmed.

```mermaid
flowchart LR
    Settings[Plugin settings] --> Bind[host + port for server listen]
    Settings --> AppDomain{appDomain set?}
    Settings --> ServerDomain{serverDomain set?}
    AppDomain -->|yes| LinkURL[appDomain/auth#...]
    AppDomain -->|no + serverDomain yes| LinkURLServer[serverDomain/auth#...]
    AppDomain -->|no + serverDomain no| LinkURLLocal[http://host:port/auth#...]
    ServerDomain -->|yes| BackendURL[serverDomain]
    ServerDomain -->|no| BackendFallback[link URL origin]
    LinkURL --> Hash[hash payload backendUrl]
    LinkURLServer --> Hash
    LinkURLLocal --> Hash
    BackendURL --> Hash
    BackendFallback --> Hash
```
