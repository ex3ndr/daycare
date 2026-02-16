# App Folder Prompt Path

App agents now include their app root directory in the permissions section of the system prompt.

## What changed

- Added `agentAppFolderPathResolve()` to resolve `<workspace>/apps/<appId>` for app descriptors.
- Passed `appFolderPath` into prompt template context.
- Updated `PERMISSIONS.md` to render the app folder path in allowed paths.

## Flow

```mermaid
flowchart TD
  A[Agent descriptor] --> B{descriptor.type === app}
  B -- no --> C[appFolderPath = empty]
  B -- yes --> D[Resolve workspace/apps/appId]
  D --> E[Inject appFolderPath into template context]
  C --> E
  E --> F[Render PERMISSIONS.md]
  F --> G[System prompt shows app folder path]
```
