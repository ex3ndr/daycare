# Task Execution Direct Runner

## Summary

Task code execution no longer enters the target agent inbox as executable `system_message` work.
The runtime now executes task code directly under the target agent context, then posts only the produced prompt text
back to the agent when inference should continue.

This is intentionally iterative:

- task routing and stats stay in `TaskExecutions`
- task code execution is isolated in `TaskExecutionRunner`
- target-agent resolution still uses `AgentSystem`
- task code still runs through the existing RLM Python block executor
- task output still reaches agent inference for async runs, but only as plain prompt text

## Flow

```mermaid
sequenceDiagram
    participant Trigger as Manual/Cron/Webhook
    participant Facade as TaskExecutions
    participant Runner as TaskExecutionRunner
    participant AgentSystem as AgentSystem.taskExecuteAndAwait/post
    participant Agent as Agent.taskExecute
    participant Tasks as TasksRepository
    participant RLM as agentLoopRun(vm_start only)
    participant Loop as Agent inbox/inference loop

    Trigger->>Facade: dispatch({taskId, target, parameters})
    Facade->>Runner: runAndAwait(...)
    Runner->>AgentSystem: resolve target agentId
    AgentSystem->>Agent: taskExecute({taskId, version, source, parameters})
    Agent->>Tasks: find task code by id/version
    Tasks-->>Agent: code + parameter schema
    Agent->>RLM: execute Python block directly
    RLM-->>Agent: output/error
    Agent-->>Runner: execution result
    Runner->>AgentSystem: post system_message {text only}
    AgentSystem->>Loop: enqueue prompt for inference
    Runner-->>Facade: execution result
    Facade->>Facade: update queued/succeeded/failed stats
```

## Notes

- This removes the inbox hop for executable task payloads.
- Target-agent wake/sleep handling still happens in `AgentSystem`.
- The follow-up agent message contains prompt text only; no task code or task reference is re-posted.
