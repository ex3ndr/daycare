# Task Executions Facade and Task Reference Dispatch

## Summary

This change unifies manual, cron, and webhook task execution through `TaskExecutions`.
Execution payloads no longer send task code. They send only:

- task reference: `task.id` and optional `task.version`
- normalized input values (`inputs`)
- execution metadata (`origin`, `context`, `sync`)

The agent resolves task code from `TasksRepository` at execution time.

## Flow

```mermaid
sequenceDiagram
    participant Trigger as Manual/Cron/Webhook
    participant Facade as TaskExecutions
    participant AgentSystem as AgentSystem.postAndAwait
    participant Agent as Agent.handleSystemMessage
    participant Tasks as TasksRepository

    Trigger->>Facade: dispatch({taskId, taskVersion?, parameters, ...})
    Facade->>AgentSystem: system_message { task: {id, version?}, inputs, sync }
    AgentSystem->>Agent: inbox item
    Agent->>Tasks: findByVersion(id, version) or findById(id)
    Tasks-->>Agent: task record (code, parameters)
    Agent->>Agent: execute resolved code
    Agent-->>Facade: system_message result
    Facade->>Facade: update queued/succeeded/failed stats
```

## Facade Responsibilities

```mermaid
flowchart TD
    A[TaskExecutions.dispatch] --> B[Record queued counters]
    B --> C[postAndAwait system_message]
    C --> D{result.responseError?}
    D -->|no| E[Record success counters]
    D -->|yes| F[Record failure counters]
    C -->|throw| F
```

## Notes

- `task_run` async path is fire-and-forget via `dispatch`.
- `task_run` sync path uses `dispatchAndAwait` and returns code execution output.
- Cron/Webhook no longer pass task code in scheduler/trigger context.
- Engine status now exposes aggregated and per-task execution counters from `TaskExecutions`.
