# App Folder Prompt Path

App agents now include their app root directory in the permissions section of the system prompt.
The prompt also shows whether `@workspace` is currently granted.

## What changed

- Added `agentAppFolderPathResolve()` to resolve `<workspace>/apps/<appId>` for app descriptors.
- Added `permissionWorkspaceGranted()` to compute app-visible `@workspace` grant status.
- Passed `appFolderPath` into prompt template context.
- Updated `PERMISSIONS.md` to render both app folder path and `@workspace` grant status.

## Flow

```mermaid
flowchart TD
  A[Agent descriptor] --> B{descriptor.type === app}
  B -- no --> C[appFolderPath = empty]
  B -- yes --> D[Resolve workspace/apps/appId]
  D --> E[Inject appFolderPath into template context]
  E --> E2[Compute workspacePermissionGranted]
  C --> E
  E2 --> F[Render PERMISSIONS.md]
  F --> G[System prompt shows app folder path + @workspace status]
```
