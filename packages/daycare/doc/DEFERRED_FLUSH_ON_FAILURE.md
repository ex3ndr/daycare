# Deferred Flush On Failure

## Summary

When a `run_python` block fails after some deferred tool payloads were already queued (for example `say()`), Daycare now flushes those queued deferred entries before writing the failure tool result.

This prevents completed side effects from being silently dropped when the model later replies with `NO_MESSAGE`.

## Flow

```mermaid
sequenceDiagram
    participant VM as run_python VM
    participant Loop as agentLoopRun
    participant Flush as deferredToolFlush
    participant Tool as executeDeferred

    VM->>Loop: tool call produces deferred payload (say)
    Loop->>Loop: queue deferred entry
    VM->>Loop: later step throws error
    Loop->>Flush: flush queued deferred entries
    Flush->>Tool: executeDeferred(payload)
    Tool-->>Flush: delivered/failed
    Flush-->>Loop: sent/failed counts
    Loop->>Loop: append rlm failure with deferred status
```
