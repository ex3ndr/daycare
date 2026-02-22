# Cron Module

Cron tasks are persisted in SQLite (`tasks_cron`) and scheduled in-memory by `CronScheduler`.

## Structure

```
cron/
├── cronTypes.ts
├── ops/
│   ├── cronExpressionParse.ts
│   ├── cronFieldMatch.ts
│   ├── cronFieldParse.ts
│   ├── cronTimeGetNext.ts
│   └── cronScheduler.ts
├── crons.ts
└── README.md
```

## Storage

Tasks are stored in `tasks_cron` with key fields:
- `id`: human task id (`daily-report`)
- `task_uid`: cron descriptor id (cuid2)
- `name`, `schedule`, `prompt`
- `enabled`, `delete_after_run`
- `last_run_at` (unix ms)

The runtime uses `CronTasksRepository` for CRUD and cached reads.

## Execution Flow

```mermaid
flowchart TD
  Engine[Engine.start] --> Storage[Storage.open + migrations]
  Storage --> Crons[cron/crons.ts]
  Crons --> Scheduler[cronScheduler.start]
  Scheduler --> Repo[cronTasksRepository.findMany]
  Scheduler --> Tick[Compute next runs]
  Tick --> AgentSystem[post system_message execute=true]
  AgentSystem --> Record[repo.update last_run_at]
```

## Tools

- `cron_add` creates/updates a cron task in SQLite
- `cron_read_task` reads task definition and prompt
- `cron_delete_task` removes a task from scheduler + SQLite
