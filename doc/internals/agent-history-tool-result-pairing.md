# Agent History Tool Result Pairing

## Problem

During restart recovery, Daycare can append synthetic `tool_result` records for pending tool calls. Anthropic requires each `tool_result` to match a `tool_use` from the immediately previous assistant turn.

If a synthetic result is replayed later without adjacency, Anthropic rejects the request with `unexpected tool_use_id`.

## Fix

`agentHistoryContext` now replays `tool_result` records only when they match tool calls from the current assistant turn and remain contiguous with that turn.

Any orphaned or delayed `tool_result` records are skipped while rebuilding inference context.

## Flow

```mermaid
flowchart TD
    A[Assistant message with tool_use persisted] --> B[Process restarts before real tool_result append]
    B --> C[Recovery appends synthetic tool_result later]
    C --> D[Restore rebuilds context from history]
    D --> E{tool_result matches current assistant turn IDs?}
    E -- Yes --> F[Include tool_result in rebuilt context]
    E -- No --> G[Drop orphaned tool_result]
    F --> H[Provider request remains valid]
    G --> H
```

## Implementation

- `packages/daycare/sources/engine/agents/ops/agentHistoryContext.ts`
- `packages/daycare/sources/engine/agents/ops/agentHistoryContext.spec.ts`
