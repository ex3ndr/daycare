# Task Descriptor Type For Trigger Defaults

## Summary

Added a new agent descriptor variant:

- `{ type: "task", id: string }`

Cron, heartbeat, and webhook triggers now default to this descriptor when no explicit `agentId` is configured.
This isolates trigger history per task instead of sharing `system:*` agents.

Model role configuration now supports a `task` role key so task agents can use a dedicated model override.

## Resolution Flow

```mermaid
flowchart TD
    Trigger[cron / heartbeat / webhook trigger] --> Target{Explicit agentId?}
    Target -->|Yes| AgentId[Use configured agentId]
    Target -->|No| Descriptor[Use descriptor type:task with task_id]
    Descriptor --> Resolve[AgentSystem.resolveEntry]
    Resolve --> Stable{descriptor.id is cuid2?}
    Stable -->|Yes| Reuse[Reuse descriptor.id as persistent agentId]
    Stable -->|No| Create[Create new agentId and map by descriptor cache key]
    Reuse --> Agent[Task-scoped persistent agent]
    Create --> Agent
```
