# Exec/Write Permission Parity

`exec` now uses the same caller-scoped write allowlist as `write` and `edit`.

Before:
- `exec` replaced caller permissions with `writeDirs: ["/tmp"]`
- `write`/`edit` used caller `writeDirs`

Now:
- `exec` copies caller permissions and preserves `writeDirs`
- host mode: `/tmp` is writable only when explicitly granted in caller permissions
- Docker mode: `/tmp` is always added to `allowWrite` to match the Docker tmpfs mount policy

```mermaid
flowchart TD
  A["Tool context permissions"] --> B["write tool"]
  A --> C["exec tool"]
  B --> D["sandboxCanWrite(target)"]
  D --> E{"target in writeDirs?"}
  E -- no --> L["deny"]
  E -- yes --> M["allow"]
  C --> F["resolveExecPermissions(copy)"]
  F --> G["sandboxFilesystemPolicyBuild(allowWrite = writeDirs)"]
  G --> H{"docker mode?"}
  H -- yes --> I["append /tmp to allowWrite"]
  H -- no --> J["keep allowWrite as-is"]
  I --> K{"command writes in allowed dirs?"}
  J --> K
  K -- no --> L
  K -- yes --> M
```
