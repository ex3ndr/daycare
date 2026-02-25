# Heartbeats

Heartbeat tasks store Python code in SQLite and execute it in a single batch on a fixed interval.

## Storage

Rows live in `tasks_heartbeat`:
- `id`, `title`, `prompt` (Python code)
- `last_run_at` (unix ms)
- `created_at`, `updated_at`

## Execution model

- `Heartbeats` wires `HeartbeatScheduler` with `HeartbeatTasksRepository`.
- On each interval (or `heartbeat_run`), scheduler loads tasks.
- `heartbeatPromptBuildBatch` wraps each task's Python code in `<run_python>` tags.
- The batch prompt is posted as `system_message` with `execute=true`.
- `executablePromptExpand` processes the `<run_python>` blocks via `rlmExecute`.
- After run, `recordRun()` updates `last_run_at` for all heartbeat rows.

```mermaid
flowchart TD
  Engine[engine.ts] --> Storage[Storage.open]
  Storage --> Repo[HeartbeatTasksRepository]
  Engine --> Heartbeats[heartbeat/heartbeats.ts]
  Heartbeats --> Scheduler[heartbeat/ops/heartbeatScheduler.ts]
  Scheduler --> Load[repo.findMany]
  Load --> Batch[heartbeatPromptBuildBatch: wrap in run_python]
  Batch --> AgentSystem[agents/agentSystem.ts]
  AgentSystem --> RLM[executablePromptExpand + rlmExecute]
  RLM --> Persist[repo.recordRun]
```

## Tools

- `heartbeat_add` creates/updates a task with Python code
- `heartbeat_run` forces immediate run
- `heartbeat_remove` deletes a task row
