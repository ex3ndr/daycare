# Shell Run Tests Tool

The shell plugin includes a `run_tests` tool that executes tests inside the sandboxed workspace.

- Default command: `yarn test`
- Optional overrides: `command`, `cwd`, `timeoutMs`
- CI guard: the tool is not registered when `CI` is enabled and also rejects direct execution in CI.

```mermaid
flowchart TD
    A[Plugin load] --> B{CI enabled?}
    B -->|yes| C[Skip run_tests registration]
    B -->|no| D[Register run_tests]
    D --> E[run_tests execute]
    E --> F[sandbox.exec with localhost allowlist]
    F --> G[Format stdout/stderr result]
```
