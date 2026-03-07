# Monty Fragment Runtime

The Monty fragment bridge now keeps fragment state inside the Python wrapper for each `init()` and action run, then syncs the final state snapshot back into the app store after execution completes.

This avoids depending on side effects from external JS functions during Monty execution and keeps `apply(...)` consistent for:

- synchronous `init()` functions
- async server-backed queries through `query_database(...)`
- action handlers that mutate fragment state before returning

```mermaid
sequenceDiagram
    participant View as MontyDevView
    participant Hook as useFragmentPython
    participant Monty as montyFragmentRun
    participant Py as Python wrapper
    participant API as /databases/:id/query

    View->>Hook: render fragment spec
    Hook->>Monty: init/action(code, current state)
    Monty->>Py: inject __fragment_initial_state
    Py->>Py: apply(...) updates local __fragment_state__
    Py->>API: query_database(...)
    API-->>Py: rows
    Py-->>Monty: { result, state, stateDirty }
    Monty-->>Hook: normalized fragment result
    Hook->>Hook: merge state into store
    Hook-->>View: rerender with final state
```
