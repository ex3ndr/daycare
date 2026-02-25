# `search_memory` Sync Mode

## Summary

`search_memory` now supports an optional `sync` boolean parameter:

- `sync` omitted or `false`: returns immediately with a query id (async mode).
- `sync=true`: waits for memory-search completion and returns the synthesized answer in the tool result (sync mode).

Background agents should prefer `sync=true` so they can use memory results in the same execution step.

## Flow

```mermaid
sequenceDiagram
    participant Caller as Agent (caller)
    participant Tool as search_memory tool
    participant Search as Memory-search agent

    alt Async mode (default)
        Caller->>Tool: search_memory(query)
        Tool->>Search: post(message)
        Tool-->>Caller: query id + async summary
        Search-->>Caller: system message later (result)
    else Sync mode (sync=true)
        Caller->>Tool: search_memory(query, sync=true)
        Tool->>Search: postAndAwait(message)
        Search-->>Tool: responseText
        Tool-->>Caller: query id + awaited result
    end
```
