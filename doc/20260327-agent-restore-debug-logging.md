# Agent Restore Debug Logging

## Summary
- Added restore-time debug logging for persisted agent sessions.
- Logs now include agent inventory counts at boot plus per-agent history/context rebuild stats.
- Restore logs include heap snapshots before history load, after history load, and after context rebuild.

## Why
- The `daycare.lab` PM2 process was crashing with V8 heap OOM during restore.
- We needed logs that point at the exact agent/session and the amount of persisted state being rebuilt.
- This keeps the next failure actionable instead of leaving only a generic heap crash.

## Flow

```mermaid
flowchart TD
    A[Engine startup] --> B[AgentSystem.load()]
    B --> C[Log total agents by lifecycle and kind]
    C --> D[Restore active agent]
    D --> E[Load persisted session history]
    E --> F[Log history counts and heap snapshot]
    F --> G[Rebuild inference context]
    G --> H[Log context message count and heap snapshot]
```
