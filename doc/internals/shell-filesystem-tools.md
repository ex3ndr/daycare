# Shell Filesystem Tools

The shell plugin now exposes four filesystem-oriented tools in addition to `read`/`write`/`edit`/`exec`:

- `write_output`
- `grep`
- `find`
- `ls`

`grep`, `find`, and `ls` execute system binaries through `sandbox.exec()` and keep output bounded for prompt safety.
`write_output` writes markdown files into `/home/outputs` with collision-safe naming.

```mermaid
flowchart TD
    A[Tool call] --> B{Tool type}
    B -->|write_output| C[Resolve unique name]
    C --> D[sandbox.write to /home/outputs]
    B -->|grep/find/ls| E[Build safe shell args]
    E --> F[sandbox.exec]
    F --> G[Format and truncate output]
    D --> H[Tool result]
    G --> H
```
