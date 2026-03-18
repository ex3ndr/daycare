# Server Command Mode

## Summary
- Updated `daycare server` to load config, print parsed `settings.json`, print loaded credentials from `auth.json`, and start the runtime.
- Added an `Engine` `server` flag so server boot can alter startup behavior.
- Server mode skips local Docker runtime image checks and stale container cleanup during startup.
- Server mode preloads `auth.json` once during boot and serves later auth reads from memory instead of re-reading the file.

## Boot Flow

```mermaid
flowchart TD
    A[daycare server] --> B[configLoad settings.json]
    B --> C[log parsed settings]
    C --> D[create Engine with server=true]
    D --> E[read and log auth.json]
    E --> F[Engine.start]
    F --> G{server mode?}
    G -->|yes| H[preload auth.json into AuthStore cache]
    H --> I[skip Docker image and stale-container checks]
    G -->|no| J[require daycare-runtime image]
    I --> K[start runtime services]
    J --> K
```
