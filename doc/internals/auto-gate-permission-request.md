# Auto Gate Permission Request

Gate permissions for heartbeat and cron tasks now request missing permissions from the foreground user instead of silently skipping the gate.

## Behavior
- If all gate permissions are present, gate execution runs as before.
- If permissions are missing, Daycare sends a permission request with `always` scope.
- If approved, permissions are granted to the task agent, permissions are re-checked, and the gate runs.
- If denied or timed out, the entire task is skipped.

## Flow
```mermaid
flowchart TD
    A[Scheduled task has gate + permissions] --> B{gatePermissionsCheck}
    B -->|Allowed| C[Run gate command]
    B -->|Missing| D[gatePermissionRequest]
    D --> E[Send permission request to foreground connector]
    E --> F{Decision before timeout}
    F -->|Approved| G[Grant permissions with scope always]
    G --> H[Re-check gate permissions]
    H -->|Allowed| C
    H -->|Still missing| I[Skip entire task]
    F -->|Denied| I
    F -->|Timed out| I
    C -->|Exit 0| J[Run scheduled task]
    C -->|Exit non-zero| I
```
