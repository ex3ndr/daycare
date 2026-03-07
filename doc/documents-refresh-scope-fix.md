# Documents Refresh Scope Fix

The documents refresh bug came from treating the current workspace as mutable store state.
That made document fetches depend on `activeId`, which could drift from the route during refreshes and briefly
scope requests to the wrong workspace.

The fix removes `activeId` and `setActive` from the app workspace store and replaces them with a route-backed
`WorkspaceProvider`. Screens now read the current workspace from context, workspace-scoped modals live under
`/:workspace/...` paths, and workspace layouts handle loading / no-access guards before any workspace consumers render.

If a route requests a workspace that is not accessible after loading, the app redirects to a dedicated
`/workspace-not-found` screen instead of silently falling back to another workspace.

```mermaid
flowchart TD
    A[Current URL] --> B[WorkspaceProvider]
    C[Workspace list] --> B
    B --> E[Workspace layout guard]
    C --> E
    E -->|Loading| F[Render nothing]
    E -->|No access| G[/workspace-not-found]
    E -->|Access granted| H[Current workspace context]
    H --> I[Documents view]
    H --> J[Files / routines / fragments modals]
    H --> K[Sync and chat APIs]
```
