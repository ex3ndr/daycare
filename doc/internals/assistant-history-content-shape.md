# Assistant History Content Shape

## Summary

`assistant_message` history records now persist full assistant `content` blocks instead of flattened `text` + `toolCalls`.

- Old shape: `assistant_message { text, files, tokens, toolCalls? }`
- New shape: `assistant_message { content, tokens }`

This preserves `thinking` blocks and keeps message ordering/fidelity for restore and replay paths.

## Flow

```mermaid
flowchart LR
    A[Inference response assistant message] --> B[agentLoopRun]
    B --> C[messageContentClone]
    C --> D[historyRecordAppend assistant_message.content]
    D --> E[(session_history.data JSON)]
    E --> F[agentHistoryContext]
    F --> G[Restored inference context messages]

    E --> H[agentHistorySummary/sessionHistoryTool/contextEstimateTokens]
    H --> I[Derived text/tool-call views from content]
```

## Notes

- No backward-compatibility shim is included for old `assistant_message` history blobs.
- Text/tool-call projections are now derived from `content` when needed.
