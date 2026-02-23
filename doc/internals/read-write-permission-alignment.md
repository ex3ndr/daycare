# Read/Write Permission Alignment

Read and write tools now enforce the same sensitive-path and dangerous-file protections as the exec sandbox policy.

- `sandboxCanRead(permissions, target)`
- `sandboxCanWrite(permissions, target)`

Shared helpers used by both tools:

- `sandboxSensitiveDenyPathsBuild` for sensitive home/system deny paths
- `sandboxPathDenyCheck` for denied directory containment checks
- `sandboxDangerousFilesBuild` + `sandboxDangerousFileCheck` for dangerous shell/git/editor targets

Read behavior:

- Absolute path resolution stays broad
- App isolation applies first
- Sensitive home/system paths are always blocked first
- Explicit read scopes (`workingDir` and `readDirs`) can override broad boundary deny roots
- Broad boundary deny roots still block non-explicit paths:
  - OS home root
  - Daycare config root (`~/.daycare` or `DAYCARE_ROOT_DIR`)
- Non-home system paths remain readable

Write behavior:

- Must be inside explicit `writeDirs`
- App isolation applies
- Write now requires a successful read check of the target (or nearest existing parent)
- Sensitive deny paths are blocked even if inside `writeDirs`
- Dangerous runtime targets (`.bashrc`, `.git/hooks`, `.vscode`, etc.) are blocked

```mermaid
flowchart TD
  A["read target"] --> B["pathResolveSecure(root, target)"]
  B --> C["sandboxAppsAccessCheck"]
  C --> D{"sensitive deny path?"}
  D -- yes --> E["deny"]
  D -- no --> F{"within workingDir/readDirs?"}
  F -- yes --> G["allow"]
  F -- no --> H{"within OS home/daycare boundary roots?"}
  H -- yes --> E
  H -- no --> G

  I["write target"] --> J["pathResolveSecure(writeDirs, target)"]
  J --> K["sandboxAppsAccessCheck"]
  K --> K2["sandboxCanRead(target or parent)"]
  K2 --> L{"sensitive deny?"}
  L -- yes --> M["deny"]
  L -- no --> N{"dangerous file/dir?"}
  N -- yes --> M
  N -- no --> O["allow"]
```
