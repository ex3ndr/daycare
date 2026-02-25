# Shell Filesystem Tools

The shell plugin now exposes four filesystem-oriented tools in addition to `read`/`write`/`edit`/`exec`:

- `write_output`
- `grep`
- `find`
- `ls`

`grep`, `find`, and `ls` execute system binaries through `sandbox.exec()` and keep output bounded for prompt safety.
`write_output` writes markdown or json files into `~/outputs` with date-prefixed collision-safe naming (`YYYYMMDDHHMMSS-name.md`). Returns the unique path — always print it.

```mermaid
flowchart TD
    A[Tool call] --> B{Tool type}
    B -->|write_output| C[Resolve date-prefixed unique name]
    C --> D[sandbox.write to ~/outputs]
    D --> I[Return written path]
    B -->|grep/find/ls| E[Build safe shell args]
    E --> F[sandbox.exec]
    F --> G[Format and truncate output]
    D --> H[Tool result]
    G --> H
```
