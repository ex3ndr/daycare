# Executable System Message Loop Unification

## Summary

Executable `system_message` execution now reuses the same `agentLoopRun` VM/tool loop as normal inference `<run_python>` handling.

Changes:
- Removed direct `rlmExecute` usage from `Agent.handleSystemMessage`.
- Added `agentLoopRun` flags for restore-only execution:
  - `stopAfterPendingPhase: true`
  - `continueAfterRunPythonError: true`
- Added support for executable prompt per-block inputs/schema stubs in `agentLoopRun` restore VM start.
- Failure/skip executions now persist `rlm_start`/`rlm_complete` records consistently.
- `skip()` executions still avoid adding `user_message` context history.

## Flow

```mermaid
flowchart TD
    A[system_message execute=true] --> B{code[] provided?}
    B -->|yes| C[Build vm_start initialPhase with block inputs/schemas]
    B -->|no| D[Extract <run_python> blocks from text]
    D --> C
    C --> E[agentLoopRun restore-only]
    E --> F[Persist rlm_start / rlm_tool_* / rlm_complete]
    F --> G{skip()?}
    G -->|yes| H[Return responseText=null]
    G -->|no| I[Collect outputs/exec_error from rlm_complete]
    I --> J[Continue normal system_message flow]
```
