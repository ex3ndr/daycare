# Agent History Inference Failure Notes

## Summary

Inference failures are now persisted as `note` records in agent history.

Changes:
- Added a best-effort history note append when the inference loop throws.
- Added a history note append when inference returns `stopReason: "error"`.
- Included provider/model identifiers and normalized error detail in the note text.
- Truncated long error details before writing to history records.

## Flow

```mermaid
flowchart TD
    A[agentLoopRun inference attempt] --> B{Failure mode}
    B -->|Exception thrown| C[Append history note: provider/model/detail]
    B -->|stopReason = error| D[Append history note: provider/model/detail]
    C --> E[Continue existing failure handling]
    D --> E
    E --> F[Notify subagent/send connector error if applicable]
```
