# Config Skills Read-Only Access

User agents now receive explicit read-only access to skills roots while keeping write access unchanged.

## What Changed

- `permissionBuildUser` now sets:
  - `writeDirs = [<user-home>]`
  - `readDirs = [<config>/users/<userId>/skills, <config>/skills]`
- `sandboxCanRead` now treats `readDirs` as explicit read allow-paths.
- `sandboxCanWrite` behavior is unchanged, so skills paths remain non-writable by default.

## Access Flow

```mermaid
flowchart TD
    A[UserHome] --> B[permissionBuildUser]
    B --> C[SessionPermissions.writeDirs]
    B --> D[SessionPermissions.readDirs]
    D --> E["<config>/skills"]
    D --> F["<config>/users/<userId>/skills"]
    G[sandboxCanRead] --> D
    G --> H[Read allowed for skills paths]
    I[sandboxCanWrite] --> C
    I --> J[Write denied for skills paths]
```
