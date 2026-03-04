# Cron send_file Foreground Connector Fallback (2026-03-04)

## Summary

`send_file` now resolves a connector target from the user's `most-recent-foreground` agent when the executing agent (for example, a cron/task agent) has no connector target.

This keeps cron executions compatible with `send_file` without requiring explicit `source` and `channelId` on every task.

## Why

Cron/task agents do not have connector path metadata, so `send_file` previously fell back to `context.source` (`"cron"`) and failed with `Connector not loaded: cron`.

## Resolution Flow

```mermaid
flowchart TD
    A[send_file invoked] --> B[Resolve target from current agent path/config]
    B -->|target found| C[Use target.connector + target.targetId]
    B -->|no target| D[Resolve most-recent-foreground agent id]
    D --> E[Load foreground agent record]
    E --> F[Resolve connector target from foreground path/config]
    F -->|target found| C
    F -->|no target| G[Fallback to legacy source logic]
    C --> H[Send via connectorRegistry.get(source)]
```
