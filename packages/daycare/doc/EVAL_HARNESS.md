# Eval Harness

## Summary

The eval harness runs a JSON scenario against a real in-process `AgentSystem`, captures the resulting history and engine events, and renders the run as markdown for human review.

The implementation stays local and deterministic:

- storage uses in-memory PGlite
- message delivery uses `postAndAwait()`
- traces come from `agentHistoryLoad()` plus `EngineEventBus`
- the CLI writes a markdown report next to the scenario by default

## Flow

```mermaid
flowchart TD
    A[Scenario JSON] --> B[evalScenarioParse]
    B --> C[evalHarnessCreate]
    C --> D[evalRun]
    D --> E[reset target agent]
    E --> F[post turns sequentially]
    F --> G[load history and collect events]
    G --> H[evalTraceRender]
    H --> I[Write .trace.md report]
```

## Supported Agent Kinds

Direct path-addressable kinds supported by the scenario format:

- `connector`
- `agent`
- `app`
- `cron`
- `task`
- `subuser`
- `supervisor`
