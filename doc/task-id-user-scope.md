# Daycare Task IDs Scoped Per User

This change scopes task IDs by `user_id` so different users can use the same `taskId` safely.

## What changed

- `tasks` identity is now `(user_id, id)` instead of global `id`.
- Task repository reads/writes/deletes are user-scoped via `ctx`.
- Task ID generation (`task_create`) checks collisions only inside the current user.
- Trigger lookups by task (`cron` and `heartbeat`) are now filtered by `ctx.userId`.
- Added migration `20260304_scope_task_ids_per_user`.

## Flow

```mermaid
flowchart TD
    A[task_create title] --> B[slugify title]
    B --> C{tasks.findAnyById(ctx, candidate)}
    C -- no --> D[use candidate]
    C -- yes --> E[next suffix]
    E --> C

    D --> F[insert tasks row]
    F --> G[(tasks PK user_id + id)]

    H[task_read / trigger ops] --> I[listTriggersForTask(ctx, taskId)]
    I --> J[query triggers by user_id + task_id]
    J --> K[only caller user's triggers]
```
