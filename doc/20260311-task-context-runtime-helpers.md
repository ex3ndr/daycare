# Task Context Runtime Helpers

## Summary

Tasks now have two additional built-in Python runtime helpers for managing the current agent session:

- `context_reset(message=None)` resets the current agent session from inside task code
- `context_compact()` runs manual compaction on the current agent session and waits for completion
- both helpers are task-only, matching the existing `step(prompt)` runtime guard

## Flow

```mermaid
sequenceDiagram
    participant Task as Task Python
    participant RLM as RLM runtime
    participant Runtime as rlmRuntimeToolExecute
    participant AgentSystem as AgentSystem.postAndAwait
    participant Agent as Current agent

    Task->>RLM: context_reset(...) / context_compact()
    RLM->>Runtime: execute built-in helper
    Runtime->>Runtime: verify taskExecution context
    Runtime->>AgentSystem: postAndAwait(reset/compact)
    AgentSystem->>Agent: enqueue session control inbox item
    Agent-->>AgentSystem: reset/compact result
    AgentSystem-->>Runtime: awaited completion
    Runtime-->>RLM: None
    RLM-->>Task: continue Python block
```

## Notes

- Outside task execution, `context_reset()` throws `context_reset() is allowed only in tasks.`
- Outside task execution, `context_compact()` throws `context_compact() is allowed only in tasks.`
- `context_reset()` accepts an optional seed message for the fresh context; omitting it clears the session completely.
