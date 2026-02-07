# Read/Write Permission Alignment

Read/write path resolution is now centralized in sandbox helpers:

- `sandboxCanRead(permissions, target)`
- `sandboxCanWrite(permissions, target)`

These functions receive `SessionPermissions` and return the resolved real path when allowed.

`sandboxCanRead` supports default read behavior: when `readDirs` is empty, any absolute path is allowed. When `readDirs` is configured, it also includes `writeDirs` so file-level write grants remain readable.

`sandboxCanWrite` only allows writes within explicitly granted `writeDirs` (it does not implicitly allow `workingDir`).

```mermaid
flowchart LR
  A["Shell read/write/edit tools"] --> B["sandboxCanRead / sandboxCanWrite"]
  B --> C["pathResolveSecure(allowedDirs, target)"]
  C --> D["realPath"]
  E["permissions.readDirs empty"] --> F["allow root of target (default read all)"]
  G["permissions.readDirs configured"] --> H["readDirs + writeDirs + workingDir"]
  F --> C
  H --> C
```
