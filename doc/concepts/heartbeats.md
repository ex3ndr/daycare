# Heartbeats

Heartbeat prompts are stored on disk and executed as a single batch on a fixed interval. Unlike cron tasks (which run independently), heartbeat tasks are collected and run together in one inference call.

## Storage

Heartbeat files live under `<config>/heartbeat/`:

| File | Purpose |
|------|---------|
| `<task-id>.md` | YAML frontmatter + prompt body |
| `.heartbeat-state.json` | Shared state for last run timestamp |

## Task format

```markdown
---
title: Check internet
gate:
  command: "curl -fsS https://api.example.com/healthz >/dev/null"
  allowedDomains:
    - api.example.com
---

If the gate command fails, notify that the internet is down.
```

### Frontmatter fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Task title |
| `gate` | no | Exec gate config that must succeed to include this task |

## Execution model

```mermaid
flowchart TD
  Scheduler[HeartbeatScheduler] -->|list tasks| Tasks[Heartbeat tasks]
  Tasks -->|filter by gate| Gate[execGateCheck]
  Gate -->|pass| Batch[Batch prompt]
  Gate -->|fail| Skip[Skip task]
  Batch -->|single call| Agent[Heartbeat agent]
```

- All passing heartbeat prompts run together as a single background agent batch.
- The batch re-runs at a fixed interval or when invoked manually.
- A single `system:heartbeat` agent handles all heartbeat runs.

## Exec gate

Works identically to cron gates. Exit code `0` includes the task; non-zero skips it. Supports `command`, `permissions`, `allowedDomains`, `packageManagers`, and `home`.

## Tools

| Tool | Description |
|------|-------------|
| `heartbeat_add` | Create or update a heartbeat prompt |
| `heartbeat_list` | List available heartbeat prompts |
| `heartbeat_run` | Run the batch immediately |
| `heartbeat_remove` | Delete a heartbeat prompt |
