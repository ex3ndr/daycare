# Process Roles

## Summary
- Added a global `hasRole()` runtime helper for process-level role checks.
- Roles come from `DAYCARE_ROLES` as a comma-separated environment variable.
- Roles are resolved once at boot and cached for the current Node.js process.
- Roles are strictly typed as `api`, `agents`, `signals`, `processes`, or `tasks`; unknown entries fail fast during boot.
- When `DAYCARE_ROLES` is unset or blank, the process has no explicit roles.
- In server mode, an empty role list keeps `api` and `agents` enabled but leaves scheduler-style work disabled.

## Resolution

```mermaid
flowchart TD
    A[Process boot] --> B[Read DAYCARE_ROLES]
    B --> C{env set?}
    C -->|no| D[cache empty role list]
    C -->|yes| E[split by comma]
    E --> F[trim entries]
    F --> G[validate api/agents/signals/processes/tasks]
    G --> H[cache typed roles]
    D --> I[hasRole uses cached roles]
    H --> I
```

## Server Runtime Defaults

```mermaid
flowchart TD
    A[Engine boot in server mode] --> B{roles configured?}
    B -->|yes| C[enable only listed roles]
    B -->|no| D[enable api and agents]
    D --> E[skip tasks, signals, processes schedulers]
    C --> F[api role starts app server]
    C --> G[agents role starts agent runtime]
    C --> H[tasks role starts cron and memory worker]
    C --> I[signals role starts delayed signals]
    C --> J[processes role starts durable process monitor]
```
