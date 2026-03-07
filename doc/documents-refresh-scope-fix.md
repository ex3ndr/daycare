# Documents Refresh Scope Fix

The documents refresh bug came from treating the current workspace as mutable store state.
That made document fetches depend on `activeId`, which could drift from the route during refreshes and briefly
scope requests to the wrong workspace.

The fix removes `activeId` and `setActive` from the app workspace store and replaces them with a route-backed
`WorkspaceProvider`. Screens now read the current workspace from context, modal routes keep workspace scope
explicit via a `workspace` query param, and the context stays `null` until the workspace list is loaded.

If a route requests a workspace that is not accessible after loading, the app redirects to a dedicated
`/workspace-not-found` screen instead of silently falling back to another workspace.

```mermaid
flowchart TD
    A[Current URL] --> B[WorkspaceProvider]
    C[Workspace list] --> B
    D[Modal query ?workspace=...] --> B
    B --> E{Workspace list loaded?}
    E -->|No| F[Context returns null]
    E -->|Yes and access granted| G[Current workspace context]
    E -->|Yes and no access| H[/workspace-not-found]
    G --> I[Documents view]
    G --> J[Files / routines / fragments modals]
    G --> K[Sync and chat APIs]
```
