# Daycare App Root Welcome Route

`daycare-app-server` now reserves the root path (`GET /`) for a plain-text welcome response:

```
Welcome to Daycare App API!
```

This prevents root from serving bundled app HTML while keeping auth and app routes available.

```mermaid
flowchart LR
  Request[HTTP request] --> Root{pathname == "/"}
  Root -->|yes| Welcome[text/plain welcome message]
  Root -->|no| Auth{auth/api/static routing}
  Auth --> Validate[/auth/validate]
  Auth --> Refresh[/auth/refresh]
  Auth --> Api[/api/* proxy]
  Auth --> Static[non-root static app assets]
```

