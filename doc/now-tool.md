# Now Tool

Daycare now exposes a core `now` tool for structured current-time lookup.

- reads the caller's user profile timezone when valid
- falls back to `UTC`
- returns both unix timestamps and localized time strings
- is used by the memory compactor task instead of relying on cron-only injected inputs
- is allowed for memory and compactor agents, not only foreground agents

```mermaid
flowchart TD
    A[now()] --> B[read user profile timezone]
    B -->|valid| C[use profile timezone]
    B -->|missing or invalid| D[use UTC]
    C --> E[return unix ms, unix seconds, utc iso, local date/time]
    D --> E
    E --> F[memory compactor task uses unixTimeMs]
```
