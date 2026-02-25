# Heartbeats

Heartbeat tasks store Python code in SQLite and execute it in a single batch on a fixed interval.

## Storage

Rows live in `tasks_heartbeat`:
- `id` (trigger id; `cuid2` by default)
- `task_id` (required FK to `tasks.id`)
- `user_id`, `title`, `code` (resolved from linked task at runtime)
- `last_run_at` (unix ms)
- `created_at`, `updated_at`

## Execution model

- `Heartbeats` wires `HeartbeatScheduler` with `HeartbeatTasksRepository`.
- On each interval (or `runNow()`), scheduler loads tasks.
- `heartbeatPromptBuildBatch` returns `{ title, text, code[] }` with task context and Python code blocks.
- The message is posted as `system_message` with `code[]` array and `execute=true`.
- `handleSystemMessage` executes each code block separately via `rlmExecute` (30s timeout each).
- After run, `recordRun()` updates `last_run_at` for all heartbeat rows.
- Runtime code/title are always resolved from the linked unified task via `task_id`.

```mermaid
flowchart TD
  Engine[engine.ts] --> Storage[Storage.open]
  Storage --> Repo[HeartbeatTasksRepository]
  Engine --> Heartbeats[heartbeat/heartbeats.ts]
  Heartbeats --> Scheduler[heartbeat/ops/heartbeatScheduler.ts]
  Scheduler --> Load[repo.findAll]
  Load --> Batch["heartbeatPromptBuildBatch: { text, code[] }"]
  Batch --> AgentSystem[agents/agentSystem.ts]
  AgentSystem --> RLM["handleSystemMessage: rlmExecute each code block"]
  RLM --> Persist[repo.recordRun]
```

## Tools

- `task_create` creates task rows and can attach a heartbeat trigger (`heartbeat: true`)
- `task_trigger_add` adds a heartbeat trigger to an existing task
- `task_trigger_remove` removes heartbeat triggers for a task
- `task_delete` removes the task and linked triggers
