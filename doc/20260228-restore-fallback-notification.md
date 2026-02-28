# Restore Failure Fallback Notification

## Summary

When agent history restore fails (for example, malformed timestamp data in persisted history), the restore flow now resets the session and sends a foreground notification:

`Session restore failed - starting from scratch.`

This prevents restore inbox items from failing hard and makes the fallback visible to the user.

## Flow

```mermaid
flowchart TD
    A[Restore inbox item] --> B[Complete pending tool-call recovery]
    B --> C[Load and rebuild history context]
    C --> D{History restore succeeded?}
    D -->|Yes| E[Persist restored context]
    D -->|No| F[Reset session with restore-failure message]
    F --> G[Send connector notification to foreground target]
    E --> H[Emit agent.restored]
    G --> H
```
