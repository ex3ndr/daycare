# IPC Agent Message and Manual Cron Trigger

## Summary

Added two IPC APIs for runtime debugging and integration testing:

- `POST /v1/engine/agents/message`
  - Sends plain text to an arbitrary agent target.
  - Supports either explicit `agentId` or descriptor-based routing (`{ type: "...", ... }`).
  - Optional `awaitResponse` returns the assistant response text for end-to-end checks.
- `POST /v1/engine/cron/tasks/:triggerId/trigger`
  - Executes a cron trigger immediately, outside schedule timing.
  - Preserves existing cron error reporting behavior (`onError` + failure follow-up message flow).

## Flow

```mermaid
flowchart TD
    A[IPC request] --> B{Endpoint}
    B -->|agents/message| C[Resolve target agentId]
    C --> D[agentSystem.post or postAndAwait]
    D --> E[Agent loop processes text message]
    B -->|cron/tasks/:id/trigger| F[Crons.triggerTask]
    F --> G[CronScheduler.triggerTaskNow]
    G --> H[Execute linked task code immediately]
    H --> I{Error?}
    I -->|No| J[Return ok]
    I -->|Yes| K[Report via cron onError]
    K --> L[Post cron:failure system message to task/agent target]
```
