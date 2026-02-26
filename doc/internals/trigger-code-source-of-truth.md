# Trigger Code Source Of Truth

## Summary

Cron and heartbeat trigger tables no longer persist duplicated `code`. Task code now lives only in `tasks.code`.

## Data Flow

```mermaid
flowchart LR
    subgraph Triggers
        C[tasks_cron\nid, task_id, schedule, ...]
        H[tasks_heartbeat\nid, task_id, title, ...]
    end

    T[tasks\nid, user_id, code, ...]

    C -->|task_id| T
    H -->|task_id| T

    S[Cron/Heartbeat schedulers]
    S -->|resolve code at run time| T
```

## Migration

- Added `20260303_drop_trigger_code`.
- Drops `code` from:
  - `tasks_cron`
  - `tasks_heartbeat`
