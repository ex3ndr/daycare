# App Workspace Refresh Debug Logging

## Summary

Added development-only route debug logging around authenticated app startup to trace the refresh bounce through `workspace-not-found`.

The logs record:

- app gate state in `(app)` layout
- workspace fetch start and success
- config fetch start and success
- the resolved pathname, workspace ids, and redirect branch in `(main)` layout

## Flow

```mermaid
sequenceDiagram
    participant Browser
    participant AppGate as (app) layout
    participant WorkspaceStore
    participant ConfigStore
    participant MainLayout as (main) layout

    Browser->>AppGate: refresh /:workspace/home
    AppGate->>WorkspaceStore: fetch workspaces
    WorkspaceStore-->>AppGate: loaded workspace ids
    AppGate->>ConfigStore: fetch configs
    ConfigStore-->>AppGate: loaded configs
    AppGate->>MainLayout: mount workspace shell
    MainLayout->>MainLayout: log pathname and routeWorkspaceId
    MainLayout-->>Browser: redirect if route resolves to missing workspace
    MainLayout-->>Browser: settle on /:workspace/home once router state stabilizes
```

## Log Labels

- `app-layout-state`
- `app-gate-block`
- `app-redirect`
- `workspaces-fetch-start`
- `workspaces-fetch-success`
- `configs-fetch-start`
- `configs-fetch-success`
- `main-layout-state`
