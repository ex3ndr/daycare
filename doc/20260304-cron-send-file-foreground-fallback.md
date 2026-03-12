# Cron send_file Foreground Connector Fallback (2026-03-04)

## Summary

`send_file` now resolves a connector recipient from the user's `most-recent-foreground` agent when the executing agent (for example, a cron/task agent) has no connector recipient.

This keeps cron executions compatible with `send_file` without requiring explicit `source` and `channelId` on every task.

## Why

Cron/task agents do not have connector path metadata, so `send_file` previously fell back to `context.source` (`"cron"`) and failed with `Connector not loaded: cron`.

## Resolution Flow

```mermaid
flowchart TD
    A[send_file invoked] --> B[Resolve recipient from current agent path/config]
    B -->|recipient found| C[Use target.connector + target.recipient.connectorKey]
    B -->|no recipient| D[Resolve most-recent-foreground agent id]
    D --> E[Load foreground agent record]
    E --> F[Resolve connector recipient from foreground path/config]
    F -->|recipient found| C
    F -->|no recipient| G[Fallback to legacy source logic]
    C --> H[Send via connectorRegistry.get(source)]
```
