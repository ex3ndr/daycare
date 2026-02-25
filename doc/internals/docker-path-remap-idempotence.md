# Docker Read `~` Path Mapping

## Summary
`read_json`, `read`, and write flows (`write`, `write_output`) support `~` paths.
In Docker mode, sandbox paths are container-relative, so `~` must mean container home (`/home`) before host rewrite happens.

Previously, `~` was expanded directly to the host home path, then the Docker rewriter also interpreted it as `/home/...` and rewrote it again.
That produced doubled host prefixes for some users.

## Fix
- Added `sandboxReadPathNormalize()` as a dedicated helper.
- In Docker mode, `~` expands to `/home` and `~/...` expands to `/home/...`.
- In non-Docker mode, `~` still expands to the host home directory.
- `sandbox.write()` now uses the same normalization path as `sandbox.read()`.
- `write_output` now passes `~/outputs/<file>` to `sandbox.write()` instead of host absolute paths.

## Flow
```mermaid
flowchart TD
    A[user path input] --> B{starts with ~ ?}
    B -- no --> C[No home expansion]
    B -- yes --> D{Docker mode?}
    D -- yes --> E[Expand to /home/...]
    D -- no --> F[Expand to host home]
    E --> G[Container to host rewrite]
    C --> G
    F --> H[No container rewrite]
```
