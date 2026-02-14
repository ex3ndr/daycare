# ACTORS.md

Known agents, their roles, and signal subscriptions.

## Agents

| Name | Kind | Role |
|------|------|------|
| heartbeat worker (`system:heartbeat`) | system | Processes scheduled heartbeat signal events and executes heartbeat prompts. |
| cron worker (`system:cron`) | system | Processes scheduled cron signal events and executes cron prompts. |
| user sessions | user | Foreground user interaction, tool execution, and permission orchestration. |
| background sessions | cron/subagent/permanent | Autonomous task execution and orchestration flows. |
| channel leaders | permanent | Route unaddressed channel messages and coordinate group channel conversation flow. |
| channel members | permanent/subagent/user | Receive targeted channel message signals when mentioned in a channel. |

## Signal Subscriptions

| Agent | Pattern | Silent | Purpose |
|-------|---------|--------|---------|
| `system:heartbeat` | `internal.heartbeat.tick` | false | Receives scheduler heartbeat batches as direct signal events. |
| `system:cron` | `internal.cron.task` | false | Receives scheduler cron executions as direct signal events. |
| channel members | `channel.<name>:*` | false | Declares channel membership and enables channel message delivery wiring for that channel. |

## Wiring Diagram

```mermaid
graph LR
  HeartbeatScheduler -->|internal.heartbeat.tick| HeartbeatWorker[system:heartbeat]
  CronScheduler -->|internal.cron.task| CronWorker[system:cron]
  ChannelTools[channel tools / CLI] -->|channel.<name>:message| ChannelMembers[channel members]
  ChannelTools -->|channel.<name>:message (fallback)| ChannelLeader[channel leader]
  HeartbeatWorker -->|tool execution + responses| Runtime[Engine Runtime]
  CronWorker -->|tool execution + responses| Runtime
  ChannelLeader -->|routing decisions + tool execution| Runtime
```

## Notes

- Scheduler-originated internal signals are delivered directly and do not require persisted user subscriptions.
- Channel message delivery is selective: mentioned users and the channel leader receive the signal payload.
