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
- `id`, `title`, `prompt` (Python code)
- `last_run_at` (unix ms)
- `created_at`, `updated_at`

The runtime uses `HeartbeatTasksRepository` for CRUD and `recordRun()` updates.

## Execution Flow

Task code is stored as raw Python. At execution time, `heartbeatPromptBuildBatch` wraps each task's code in `<run_python>` tags so the existing executable-prompt pipeline handles it.

```mermaid
flowchart TD
  Engine[Engine.start] --> Storage[Storage.open + migrations]
  Storage --> Heartbeats[heartbeat/heartbeats.ts]
  Heartbeats --> Scheduler[heartbeatScheduler.start]
  Scheduler --> Tick[Interval tick]
  Tick --> Load[repo.findMany]
  Load --> Batch[Wrap Python in run_python tags]
  Batch --> AgentSystem[post system_message execute=true]
  AgentSystem --> RLM[executablePromptExpand + rlmExecute]
  RLM --> Record[repo.recordRun unix ms]
```

## Tools

- `heartbeat_add` creates/updates heartbeat tasks with Python code
- `heartbeat_run` runs matching heartbeat tasks immediately
- `heartbeat_remove` deletes a heartbeat task
