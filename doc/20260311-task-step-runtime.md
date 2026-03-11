# Task Step Runtime Helper

## Summary

Tasks now have a built-in `step(prompt)` helper in the Python runtime.

- `step(prompt)` is executed as an inline RLM runtime helper
- it is allowed only when the current Python block is running as a task execution
- it sends a plain `system_message` prompt to the current target agent
- it waits for that agent turn to complete before returning to the task
- it returns no value to task code

## Flow

```mermaid
sequenceDiagram
    participant Task as Task Python
    participant RLM as RLM runtime
    participant Runtime as rlmRuntimeToolExecute(step)
    participant AgentSystem as AgentSystem.postAndAwait
    participant Agent as Target agent loop

    Task->>RLM: step("prompt")
    RLM->>Runtime: execute built-in helper
    Runtime->>Runtime: verify taskExecution context
    Runtime->>AgentSystem: postAndAwait(system_message text)
    AgentSystem->>Agent: enqueue + run target agent turn
    Agent-->>AgentSystem: system_message result
    AgentSystem-->>Runtime: awaited completion
    Runtime-->>RLM: None
    RLM-->>Task: continue Python block
```

## Notes

- Outside task execution, `step(prompt)` throws `step() is allowed only in tasks.`
- The helper is separate from `skip()`: `step()` continues the task after the awaited agent turn finishes.
