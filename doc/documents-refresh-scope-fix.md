# Documents Refresh Scope Fix

The documents refresh bug came from treating the current workspace as mutable store state.
That made document fetches depend on `activeId`, which could drift from the route during refreshes and briefly
scope requests to the wrong workspace.

The fix removes `activeId` and `setActive` from the app workspace store and replaces them with a layout-resolved
`WorkspaceProvider`. Screens now read the current workspace from context, workspace-scoped modals live under
`/:workspace/...` paths, non-workspace routes redirect before the workspace shell mounts, and workspace layouts
handle loading / no-access guards before any workspace consumers render.

If a route requests a workspace that is not accessible after loading, the app redirects to a dedicated
`/workspace-not-found` screen instead of silently falling back to another workspace.

```mermaid
flowchart TD
    A[Current URL] --> B[Workspace layout]
    C[Workspace list] --> B
    B -->|Loading| D[Render nothing]
    B -->|No workspace in route| E[Redirect to default workspace]
    B -->|No access| F[/workspace-not-found]
    B -->|Access granted| G[WorkspaceProvider]
    G --> H[Documents view]
    G --> I[Files / routines / fragments modals]
    G --> J[WorkspaceSync and chat APIs]
```
