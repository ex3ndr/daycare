# Deferred Delivery Retry

## Summary

Deferred tool messages are now retried during flush before being marked as failed.

- Max attempts: `3`
- Backoff: `200ms`, `400ms`
- Scope: `deferredToolFlush` in run_python completion path

## Flow

```mermaid
sequenceDiagram
    participant Loop as agentLoopRun
    participant Flush as deferredToolFlush
    participant Handler as executeDeferred

    Loop->>Flush: flush(entries, context)
    loop each deferred entry
        Flush->>Handler: attempt 1
        alt success
            Handler-->>Flush: ok
            Flush-->>Loop: sent += 1
        else failure
            Handler-->>Flush: error
            Flush->>Handler: retry after 200ms
            alt success
                Handler-->>Flush: ok
                Flush-->>Loop: sent += 1
            else failure
                Handler-->>Flush: error
                Flush->>Handler: retry after 400ms
                alt success
                    Handler-->>Flush: ok
                    Flush-->>Loop: sent += 1
                else failure
                    Handler-->>Flush: error
                    Flush-->>Loop: failed += 1
                end
            end
        end
    end
```
