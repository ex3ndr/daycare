# Heartbeat Module

Heartbeat tasks store Python code in SQLite (`tasks_heartbeat`) and execute it as a batch on a fixed interval.

## Structure

```
heartbeat/
├── heartbeatTypes.ts
├── ops/
│   ├── heartbeatPromptBuildBatch.ts
│   └── heartbeatScheduler.ts
├── heartbeats.ts
└── README.md
```

## Storage

Heartbeat rows live in `tasks_heartbeat`:
- `id`, `title`, `code` (Python code)
- `last_run_at` (unix ms)
- `created_at`, `updated_at`

The runtime uses `HeartbeatTasksRepository` for CRUD and `recordRun()` updates.

## Execution Flow

Task code is stored as raw Python. At execution time, `heartbeatPromptBuildBatch` returns `{ title, text, code[] }` — prefix context and an array of Python code blocks. The message is posted with the `code[]` array; `handleSystemMessage` executes each block directly via `rlmExecute` (30s timeout each).

```mermaid
flowchart TD
  Engine[Engine.start] --> Storage[Storage.open + migrations]
  Storage --> Heartbeats[heartbeat/heartbeats.ts]
  Heartbeats --> Scheduler[heartbeatScheduler.start]
  Scheduler --> Tick[Interval tick]
  Tick --> Load[repo.findMany]
  Load --> Batch["heartbeatPromptBuildBatch: { text, code[] }"]
  Batch --> AgentSystem["post system_message with code[] array"]
  AgentSystem --> RLM["handleSystemMessage: rlmExecute each code block"]
  RLM --> Record[repo.recordRun unix ms]
```

## Tools

- `heartbeat_add` creates/updates heartbeat tasks with Python code
- `heartbeat_run` runs matching heartbeat tasks immediately
- `heartbeat_remove` deletes a heartbeat task
