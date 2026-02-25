# Tasks Internals

## Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
```

Trigger tables link to `tasks.id`:
- `tasks_cron.task_id`
- `tasks_heartbeat.task_id`

`tasks_cron.task_uid` is removed and `tasks_cron.task_id` is required.
Legacy trigger `code` columns remain for storage compatibility, but runtime execution reads code from `tasks.code` only.

## ID Semantics

- Task ids are slug ids generated from task titles via `stringSlugify`.
- Duplicate task titles append numeric suffixes (`foo`, `foo-2`, `foo-3`).
- Cron and heartbeat trigger ids default to `cuid2` values.
- Deleting a task sets `deleted_at`; ids remain reserved and are not reused.

```mermaid
flowchart LR
  Title[Task title] --> Slug[stringSlugify]
  Slug --> TaskId[task id]
  Trigger[cron/heartbeat create] --> Cuid2[createId cuid2]
  Cuid2 --> TriggerId[trigger id]
```

## Migration Strategy

1. Add `tasks` table.
2. Add `task_id` columns to trigger tables.
3. Require `tasks_cron.task_id` and remove `tasks_cron.task_uid`.
4. Keep trigger `code` columns as non-authoritative legacy fields.

```mermaid
sequenceDiagram
  participant M as Migrations
  participant C as tasks_cron
  participant T as tasks

  M->>T: CREATE TABLE tasks
  M->>C: ADD COLUMN task_id
  M->>C: Validate task_id is present
  M->>C: Validate task_id references tasks.id
  M->>C: Rebuild table without task_uid
  M->>C: Enforce task_id NOT NULL
```

## Runtime Resolution

- `CronScheduler` resolves code from `tasksRepository.findById(task_id)` and errors if the linked task is missing.
- `HeartbeatScheduler` resolves each trigger's code from `tasks` and errors if the linked task is missing.
- `Crons` and `Heartbeats` facades delete orphaned tasks when the last trigger is removed.
