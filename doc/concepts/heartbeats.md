# Heartbeats

Heartbeat tasks store Python code in SQLite and execute it as a single batch on a fixed interval. Unlike cron tasks (which run independently), heartbeat tasks are collected and run together.

## Storage

Heartbeat rows live in `tasks_heartbeat`:
- `id` (trigger id; `cuid2` by default)
- `task_id` (required reference to `tasks.id`)
- `user_id`, `title`, `code` (runtime code resolves from linked task)
- `last_run_at` (unix ms)
- `created_at`, `updated_at`

## Task format

Heartbeat tasks store Python code that runs on each tick:

```python
# Check if service is responsive
result = http_fetch(url="https://example.com/health")
if result["status"] != 200:
    print("Service is down!")
else:
    skip()  # nothing to report
```

All agent tools are available as Python functions. Call `skip()` to abort inference when there is nothing to report.

## Execution model

```mermaid
flowchart TD
  Scheduler[HeartbeatScheduler] -->|list tasks| Tasks[Heartbeat tasks]
  Tasks --> Build["Build { text, code[] }"]
  Build -->|single call| Agent[Heartbeat agent]
  Agent --> RLM["handleSystemMessage: rlmExecute each code block"]
```

- All heartbeat tasks run together as a single background agent batch.
- The batch re-runs at a fixed interval or when invoked manually.
- A single `system:heartbeat` agent handles all heartbeat runs.
- Each Python code block is executed separately via `rlmExecute` with a 30s timeout.

## Tools

| Tool | Description |
|------|-------------|
| `task_create` | Create a task and optionally attach a heartbeat trigger (`heartbeat: true`) |
| `task_trigger_add` | Add a heartbeat trigger to an existing task |
| `task_trigger_remove` | Remove heartbeat trigger(s) from a task |
| `task_delete` | Delete a task and all linked triggers |
| `topology` | View heartbeat tasks with agents, cron tasks, and signal subscriptions |
