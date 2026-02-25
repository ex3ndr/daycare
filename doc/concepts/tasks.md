# Unified Tasks

Daycare now uses a unified task model:
- `tasks` stores Python code and task metadata (`title`, `description`)
- tasks are soft-deleted (`deleted_at`) so historical ids are never reused
- `tasks_cron` stores cron triggers
- `tasks_heartbeat` stores heartbeat triggers
- triggers reference tasks through `task_id`
- task ids are slug ids generated from task titles (e.g. `daily-check`, `daily-check-2`)
- trigger ids are arbitrary `cuid2` ids

A single task can be:
- run manually with `task_run`
- scheduled with a cron trigger
- scheduled with a heartbeat trigger
- scheduled by both cron and heartbeat at the same time

```mermaid
flowchart TD
  Task[Task in tasks table] --> CronTrigger[tasks_cron trigger]
  Task --> HeartbeatTrigger[tasks_heartbeat trigger]
  Task --> ManualRun[task_run tool]

  CronTrigger --> CronAgent[system:cron agent]
  HeartbeatTrigger --> HeartbeatAgent[system:heartbeat agent]
  ManualRun --> TaskAgent[system:task agent or explicit agentId]

  CronAgent --> Exec[Python execution via RLM]
  HeartbeatAgent --> Exec
  TaskAgent --> Exec
```

Trigger-facing shape:
- heartbeat trigger: `id`, `type: "heartbeat"`
- cron trigger: `id`, `type: "cron"`, `schedule`

## Tools

- `task_create`: create task and optional triggers
- `task_read`: read task and linked triggers
- `task_update`: update task fields
- `task_delete`: remove task and all triggers
- `task_run`: run task immediately
- `task_trigger_add`: add cron or heartbeat trigger
- `task_trigger_remove`: remove cron or heartbeat trigger
