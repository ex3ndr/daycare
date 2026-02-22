# Exec/Write Permission Parity

`exec` now uses the same caller-scoped write allowlist as `write` and `edit`.

Before:
- `exec` replaced caller permissions with `writeDirs: ["/tmp"]`
- `write`/`edit` used caller `writeDirs`

Now:
- `exec` copies caller permissions and preserves `writeDirs`
- `/tmp` is writable only when explicitly granted in caller permissions

```mermaid
flowchart TD
  A["Tool context permissions"] --> B["write tool"]
  A --> C["exec tool"]
  B --> D["sandboxCanWrite(target)"]
  C --> E["resolveExecPermissions(copy)"]
  E --> F["sandboxFilesystemPolicyBuild(allowWrite = writeDirs)"]
  D --> G{"target in writeDirs?"}
  F --> H{"command writes in writeDirs?"}
  G -- no --> I["deny"]
  H -- no --> I
  G -- yes --> J["allow"]
  H -- yes --> J
```
