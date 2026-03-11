# Exec Background Flag

`exec` no longer backgrounds commands implicitly. Foreground runs now wait for completion and kill the command on
timeout, while `background: true` opts into session-scoped background execution.

## What Changed

- Replaced `detachOnTimeout` with an explicit `background` flag on the shell `exec` tool.
- Foreground `exec` now keeps waiting through intermediate stdout/stderr updates instead of returning early with a
  live `processId`.
- Foreground `exec` stops the command when `timeoutMs` is hit and reports `timedOut: true`.
- `background: true` returns a `processId` immediately for `exec_poll` / `exec_kill`.

## Flow

```mermaid
flowchart TD
    A[exec tool call] --> B{background?}
    B -->|false| C[Wait for exit]
    C --> D{Exited before timeout?}
    D -->|Yes| E[Return final stdout/stderr]
    D -->|No| F[Send SIGTERM then SIGKILL if needed]
    F --> G[Return timedOut=true]
    B -->|true| H[Start session exec]
    H --> I[Return processId immediately]
    I --> J[exec_poll / exec_kill]
```
