# Cron Failure Reporting

## Summary

Cron task failures now produce a follow-up system message instead of only logging.

Changes:
- Executable system messages now preserve `responseError` even when not running in `sync` mode.
- Cron execution treats `responseError` as a task failure.
- Cron `onError` now posts a `cron:failure` system message with:
  - `triggerId`
  - `taskId`
  - failure detail
  - instruction to try fixing the task before the next run
- Failure report routing now matches execution routing:
  - explicit `agentId` when set on the trigger
  - otherwise task descriptor `{ type: "task", id: taskId }`

## Flow

```mermaid
flowchart TD
    A[CronScheduler executes trigger] --> B[Crons posts executable system_message]
    B --> C{responseError or throw?}
    C -->|No| D[Run succeeds]
    C -->|Yes| E[CronScheduler onError]
    E --> F[Load trigger from tasks_cron]
    F --> G[Resolve target: agentId or task descriptor]
    G --> H[Post cron:failure system_message]
    H --> I[Message includes triggerId + taskId and fix instruction]
```
