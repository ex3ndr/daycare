# `run_python` Description Labels

## Summary

The `run_python` tool now accepts an optional `description` field. When present, Daycare persists that label on the `rlm_start` history record so restart recovery and the app UI can show a short human-readable summary for the Python block.

## Flow

```mermaid
flowchart LR
    A[Assistant tool call\nrun_python(code, description?)] --> B[agentLoopRun partitions tool calls]
    B --> C[Block state stores code + toolCallId + description]
    C --> D[rlm_start history record persists description]
    D --> E[Pending phase recovery reloads blockDescriptions]
    D --> F[Chat UI renders rlm_start only when description exists]
```

## Notes

- `description` is optional and ignored when blank.
- The system prompt now explicitly asks the model to provide `description` for most non-trivial `run_python` calls.
- Existing `run_python` executions without a description continue to work unchanged.
- The chat UI still skips `rlm_start` records that do not carry a description.
