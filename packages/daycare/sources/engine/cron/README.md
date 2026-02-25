# Cron Module

Cron tasks store Python code in SQLite (`tasks_cron`) and are scheduled in-memory by `CronScheduler`.

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
- `name`, `schedule`, `code` (Python code)
- `enabled`, `delete_after_run`
- `last_run_at` (unix ms)

The runtime uses `CronTasksRepository` for CRUD and cached reads.

## Execution Flow

Task code is stored as raw Python. At execution time, `cronTaskPromptBuild` returns `{ text, code[] }` — cron metadata and a single Python code block. The message is posted with the `code[]` array; `handleSystemMessage` executes each block directly via `rlmExecute` (30s timeout each).

```mermaid
flowchart TD
  Engine[Engine.start] --> Storage[Storage.open + migrations]
  Storage --> Crons[cron/crons.ts]
  Crons --> Scheduler[cronScheduler.start]
  Scheduler --> Repo[cronTasksRepository.findMany]
  Scheduler --> Tick[Compute next runs]
  Tick --> Build["cronTaskPromptBuild: { text, code[] }"]
  Build --> AgentSystem["post system_message with code[] array"]
  AgentSystem --> RLM["handleSystemMessage: rlmExecute each code block"]
  RLM --> Record[repo.update last_run_at]
```

## Tools

- `cron_add` creates/updates a cron task with Python code
- `cron_read_task` reads task definition and code
- `cron_delete_task` removes a task from scheduler + SQLite
