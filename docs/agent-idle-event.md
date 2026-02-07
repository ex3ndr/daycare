# Agent idle event

## Summary

The agent lifecycle now includes an `idle` phase. When an agent transitions to `sleeping`, the system schedules a delayed signal for 60 seconds later via the persistent delayed-signals queue.

If the agent wakes before the delay expires, the pending idle emission is canceled.

On successful idle transition, the engine emits:

- Engine event: `agent.idle`
- Lifecycle signal: `agent:<agentId>:idle`

## Lifecycle flow

```mermaid
sequenceDiagram
    participant A as AgentSystem
    participant D as DelayedSignals
    participant E as Engine Event Bus
    participant S as Signals

    A->>E: emit agent.sleep
    A->>S: generate agent:<id>:sleep
    A->>D: schedule agent:<id>:idle (+60s, repeatKey=lifecycle-idle)

    alt wakes before timeout
        A->>D: cancel agent:<id>:idle by repeatKey
        A->>E: emit agent.woke
        A->>S: generate agent:<id>:wake
    else remains sleeping for 60s
        D->>S: generate agent:<id>:idle
        A->>E: emit agent.idle
    end
```
