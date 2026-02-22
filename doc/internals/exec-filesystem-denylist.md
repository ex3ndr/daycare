# Exec Filesystem Denylist

`exec` now applies a default filesystem deny policy in the sandbox for both reads and writes.
This is a defense-in-depth layer for sensitive host paths (for example `~/.ssh`) on Linux and macOS.

Policy shape:
- `allowWrite`: granted `writeDirs` only
- `denyRead`: default sensitive paths
- `denyWrite`: same as `denyRead`

Default sensitive paths include:
- Home secrets: `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.kube`, `~/.docker`, `~/.netrc`
- Linux/macOS system secrets: `/etc/ssh`, `/etc/sudoers`, `/etc/shadow`, `/etc/ssl/private`
- macOS key material: `~/Library/Keychains`, `~/Library/Application Support/com.apple.TCC`

```mermaid
flowchart TD
  A[SessionPermissions] --> B[sandboxFilesystemPolicyBuild]
  B --> C[allowWrite = writeDirs only]
  B --> D[denyRead = default sensitive paths]
  B --> E[denyWrite = denyRead]
  C --> F[SandboxRuntime filesystem config]
  D --> F
  E --> F
  F --> G[exec tool command]
```
