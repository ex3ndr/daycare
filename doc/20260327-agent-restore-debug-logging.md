# Agent Restore Debug Logging

## Summary
- Added restore-time debug logging for persisted agent sessions.
- Logs now include agent inventory counts at boot plus per-agent history/context rebuild stats.
- Restore logs include heap snapshots before history load, after history load, and after context rebuild.
- Restore stats now report the approximate rebuilt context shape that `agentHistoryContext()` would materialize instead of naive raw-history text totals.
- Restore now loads only the active session tail needed after the latest compacted summary boundary and avoids hydrating old tool checkpoint rows into memory.

## Why
- The `daycare.lab` PM2 process was crashing with V8 heap OOM during restore.
- We needed logs that point at the exact agent/session and the amount of persisted state being rebuilt.
- This keeps the next failure actionable instead of leaving only a generic heap crash.
- Raw history can contain many checkpoint and tool rows that never become replayed context, so restore debug needs to distinguish rebuilt context from skipped records.
- The actual crash path was also parsing whole active sessions before restore, even when only the latest compacted tail was needed.

## Flow

```mermaid
flowchart TD
    A[Engine startup] --> B[AgentSystem.load()]
    B --> C[Log total agents by lifecycle and kind]
    C --> D[Restore active agent]
    D --> E[Load pending-phase tail for crash recovery]
    E --> F[Load restore tail after latest summary boundary]
    F --> G[Log history counts and heap snapshot]
    G --> H[Rebuild inference context]
    H --> I[Log context message count and heap snapshot]
```
