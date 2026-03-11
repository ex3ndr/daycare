# Background Workflow Tool

## Summary

Added `start_background_workflow`, a new core tool that starts a fresh subagent and kicks it off with executable work instead of a plain prompt.

- Inline Python code can run first inside the new child agent.
- Stored tasks can run first inside the new child agent.
- Stored-task execution reuses the shared `TaskExecutions` facade.
- Inline code is verified up front with `rlmVerify`.
- Task parameter validation matches `task_run`.

## Flow

```mermaid
flowchart TD
    A[Caller agent] -->|start_background_workflow| B{Input kind}
    B -->|code| C[Verify code and optional input schema]
    B -->|taskId| D[Resolve task and validate parameters]
    C --> E[Allocate child subagent path]
    D --> E
    E --> F[Resolve concrete child agentId]
    F --> G{Execution path}
    G -->|code| H[Post executable system_message with code]
    G -->|task| I[Dispatch through TaskExecutions to child agent]
    H --> J[Child agent executes code]
    I --> J
    J --> K[Optional printed output becomes child agent context]
```
