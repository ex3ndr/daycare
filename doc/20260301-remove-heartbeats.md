# Remove Heartbeats

## Summary

Removed heartbeat scheduling and trigger support from Daycare runtime.

- Deleted heartbeat engine module and storage repository.
- Removed heartbeat trigger type from task tools.
- Removed heartbeat wiring from `Engine`, `AgentSystem`, and tool execution context.
- Removed heartbeat API exposure from IPC server.
- Removed heartbeat model role.
- Removed heartbeat system-agent prompt registration.
- Dropped `tasks_heartbeat` with a forward migration.

## Runtime Topology (After)

```mermaid
flowchart LR
    Engine --> AgentSystem
    Engine --> Crons
    Engine --> Webhooks
    AgentSystem --> Tools
    Tools --> TaskCreate[task_create]
    Tools --> TaskTriggerAdd[task_trigger_add cron/webhook]
    Tools --> TaskTriggerRemove[task_trigger_remove cron/webhook]
    Crons --> Tasks[(tasks)]
    Crons --> TasksCron[(tasks_cron)]
    Webhooks --> TasksWebhook[(tasks_webhook)]
```

## Storage Migration

```mermaid
flowchart TD
    A[Existing DB] --> B[Apply 20260301_drop_legacy_task_trigger_table]
    B --> C[DROP TABLE IF EXISTS tasks_heartbeat]
    C --> D[Schema matches runtime: tasks + tasks_cron + tasks_webhook]
```

## Notes

- Cron and webhook behavior are unchanged.
- `topology` now reports task cron triggers only.
- Active-task summaries now contain `cron` and `webhook` triggers.
