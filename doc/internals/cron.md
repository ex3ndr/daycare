# Cron scheduler

Cron tasks store Python code in SQLite and are loaded at startup.

## Task storage

Rows live in `tasks_cron`:
- `id` (task slug)
- `task_uid` (cuid2 descriptor id)
- `name`, `description`, `schedule`, `prompt` (Python code)
- `agent_id`, `user_id`
- `enabled`, `delete_after_run`
- `last_run_at` (unix ms)

## Execution model

- `Crons` wires `CronScheduler` with `CronTasksRepository`.
- `CronScheduler` loads enabled rows and schedules next runs.
- For each due task, `cronTaskPromptBuild` wraps the Python code in `<run_python>` tags.
- The prompt is posted as `system_message` with `execute=true`.
- `executablePromptExpand` processes the `<run_python>` block via `rlmExecute`.
- After execution, `last_run_at` is persisted back to SQLite.

```mermaid
flowchart TD
  Engine[engine.ts] --> Storage[Storage.open]
  Storage --> Repo[CronTasksRepository]
  Engine --> Crons[cron/crons.ts]
  Crons --> Scheduler[cron/ops/cronScheduler.ts]
  Scheduler --> RepoLoad[repo.findMany enabled]
  Scheduler --> Wrap[cronTaskPromptBuild: wrap in run_python]
  Wrap --> AgentSystem[agents/agentSystem.ts]
  AgentSystem --> RLM[executablePromptExpand + rlmExecute]
  RLM --> Persist[repo.update last_run_at]
```

## Tools

- `cron_add` creates/updates a task with Python code
- `cron_read_task` reads task details and code
- `cron_delete_task` removes task row + in-memory schedule
