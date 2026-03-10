# Processes Sandbox Runtime

Managed background processes now run entirely through the shared `Sandbox` abstraction instead of maintaining a separate Docker-specific process runtime.

## What changed

- durable processes create a dedicated sandbox per process id
- process lifecycle uses sandbox exec for start, status, and stop
- sandbox-backed process sandboxes can be destroyed through the backend interface
- mount definitions now preserve `readOnly` so process sandboxes can mix writable state with read-only inputs
- process path handling normalizes macOS temp paths so Docker mount checks do not recreate the sandbox container on every exec
- FIFO control writes are bounded to avoid hanging when the supervisor is already gone

```mermaid
flowchart TD
    A[Processes facade] --> B[ProcessRuntime sandbox adapter]
    B --> C[Sandbox]
    C --> D[Docker exec backend]
    D --> E[daycare runtime container]
    E --> F[daycare-exec-supervisor]
    F --> G[managed process tree]
    B --> H[/process/control.fifo]
    H --> F
```

## Notes

- each process sandbox uses `process-<processId>` as its sandbox user id
- `/process` and process home stay writable; permission-derived mounts can remain read-only
- stop first signals through the supervisor FIFO, then falls back to direct `kill -KILL` polling if needed
