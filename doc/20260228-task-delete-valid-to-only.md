# Task Delete Uses `valid_to` Only

## Summary

Task soft delete no longer uses `tasks.deleted_at`.

- Removed `deletedAt` from task schema and task storage types.
- Task delete now closes the current version by setting `valid_to`.
- Added migration `20260228_tasks_drop_deleted_at.sql` to drop `tasks.deleted_at`.

## Delete Flow

```mermaid
sequenceDiagram
    participant Repo as TasksRepository
    participant DB as Database

    Repo->>DB: SELECT current task WHERE user_id=?, id=?, valid_to IS NULL
    DB-->>Repo: current row
    Repo->>DB: UPDATE tasks SET valid_to = now WHERE (user_id,id,version) AND valid_to IS NULL
    Repo-->>Repo: remove task from current cache
```

## Read Semantics

```mermaid
flowchart TD
    A[findById / findMany] --> B[Filter valid_to IS NULL]
    B --> C[Current tasks only]

    D[findAnyById] --> E[Read latest version regardless of valid_to]
    E --> F[Used for id reservation checks]
```
