# Docker Tmpfs Mounts for Temp and Run Paths

Daycare Docker sandbox containers mount `/tmp`, `/run`, `/var/tmp`, and `/var/run` as writable tmpfs.

## What Changed

- `dockerContainerEnsure` sets `HostConfig.Tmpfs["/tmp"]`, `HostConfig.Tmpfs["/run"]`,
  `HostConfig.Tmpfs["/var/tmp"]`, and `HostConfig.Tmpfs["/var/run"]` to `"rw"` when creating sandbox containers.
- Containers are labeled with `daycare.tmpfs.tmp = "1"`, `daycare.tmpfs.run = "1"`,
  `daycare.tmpfs.var_tmp = "1"`, and `daycare.tmpfs.var_run = "1"` to track these runtime requirements.
- Existing containers missing any required tmpfs label are treated as stale and recreated.
- Docker `exec` runtime config always includes `/tmp`, `/run`, `/var/tmp`, and `/var/run` in sandbox `allowWrite`.

This guarantees writable temporary space in Docker mode even when rootfs constraints are enabled.

```mermaid
flowchart TD
    A[dockerContainerEnsure inspect existing container] --> B{tmpfs labels present and equal 1?}
    B -- no --> C[stale -> stop + remove + recreate]
    B -- yes --> D[reuse existing container]
    C --> E[createContainer HostConfig.Tmpfs for temp and run paths]
    E --> F[label tmpfs flags for /tmp /run /var/tmp /var/run]
    D --> G[dockerRunInSandbox rewrites runtime config]
    G --> H[append /tmp /run /var/tmp /var/run to allowWrite]
```
