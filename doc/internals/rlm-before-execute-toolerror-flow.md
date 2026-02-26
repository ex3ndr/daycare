# RLM beforeExecute ToolError Flow

Checkpoint persistence errors from `beforeExecute` are now handled inside `rlmStepToolCall` and converted into normal `ToolError` tool results.

## Summary

- `beforeExecute` errors no longer write `rlm_tool_result` directly in callbacks.
- `rlmStepToolCall` catches those errors (except `AbortError`) and returns `toolIsError=true` with `ToolError: ...`.
- Callers (`agentLoopRun`, `rlmExecute`) append `rlm_tool_result` from the returned step result.
- Python code can catch these failures with `except ToolError`.

```mermaid
sequenceDiagram
    participant Loop as agentLoopRun / rlmExecute
    participant Step as rlmStepToolCall
    participant Hook as beforeExecute
    participant Snap as rlmSnapshotSave
    participant Hist as History
    participant VM as Monty resume

    Loop->>Step: rlmStepToolCall(snapshot,...)
    Step->>Hook: beforeExecute(snapshotDump,...)
    Hook->>Snap: persist checkpoint
    alt checkpoint save fails
        Snap-->>Hook: throw error
        Hook-->>Step: throw "failed to persist checkpoint"
        Step-->>Loop: stepResult(toolIsError=true, toolResult="ToolError: ...")
        Loop->>Hist: append rlm_tool_result (error)
        Loop->>VM: resume with RuntimeError(ToolError)
    else checkpoint save succeeds
        Hook->>Hist: append rlm_tool_call
        Hook-->>Step: ok
        Step->>Loop: normal tool result
    end
```
