# System Prompt Examples Paths

The system prompt now resolves bundled examples paths at runtime and documents both runtime modes in:

- Python tool guidance (`TOOLS_PYTHON`)
- Permissions section (`SYSTEM_PERMISSIONS`) as explicit read allowlist entries

## Paths in Prompt

- Docker runtime: `/shared/examples`
- Non-Docker runtime: resolved by `bundledExamplesDirResolve()` (for example `sources/examples` in dev and `dist/examples` in built output)

This helps the model locate example scripts regardless of whether sandbox exec runs in Docker and keeps read permissions explicit in the prompt.

```mermaid
flowchart TD
    A[bundledExamplesDirResolve] --> B{Runtime mode}
    B -- Docker --> C[/shared/examples]
    B -- Non-Docker --> D[resolved host examples dir]
    C --> E[TOOLS_PYTHON guidance]
    D --> E
    C --> F[SYSTEM_PERMISSIONS read allowlist]
    D --> F
```
