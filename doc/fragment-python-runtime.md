# Fragment Python Runtime

The fragment runtime now uses async-capable external functions instead of passing state into Python action signatures.

## Runtime Flow

```mermaid
flowchart TD
    A[Fragment screen mounts] --> B[Create fallback store from spec.state]
    B --> C[Render fragment immediately]
    C --> D[Show top-right loader while busy]
    D --> E[Load Monty runtime]
    E --> F[Run init via runMontyAsync]
    F --> G[Python calls get_state/apply/query_database]
    G --> H[JS merges state into StateStore]
    H --> I[Loader clears when pending work reaches zero]
```

## Python API

```mermaid
flowchart LR
    A[get_state()] --> B[Read current store snapshot]
    C[apply({...})] --> D[Deep-merge patch into store]
    E[apply(lambda state: {...})] --> F[Evaluate lambda in Python]
    F --> D
    G[await query_database(dbId, sql, params)] --> H[POST /databases/:id/query]
    H --> I[Rows returned to Python]
```

## Notes

- `init()` may be synchronous or async.
- Action functions receive `params` only.
- `spec.state` renders immediately, then Python can refine it asynchronously.
- Busy state covers both initial mount work and later action-triggered work.
