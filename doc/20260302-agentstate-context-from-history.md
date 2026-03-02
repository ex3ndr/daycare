# AgentState token removal and message-based context usage

## Summary
- Removed `tokens` from `AgentState` persistence and runtime state.
- `/context` now estimates usage from session message history instead of reading cached token stats from agent state.
- `messageContextStatus` now renders estimate-only output.

## Flow update
```mermaid
flowchart TD
    A[/context command/] --> B[Resolve target agent by path]
    B --> C[Load active-session history records]
    C --> D[Estimate tokens via contextEstimateTokens]
    D --> E[Render messageContextStatus used/limit]
    E --> F[Send response via connector]
```

## State update
```mermaid
flowchart LR
    Old[AgentState persisted tokens] --> Removed[No tokens field in AgentState]
    Removed --> Runtime[Compaction baseline reads latest assistant history tokens]
    Removed --> ContextCmd[/context uses history-based estimate]
```
