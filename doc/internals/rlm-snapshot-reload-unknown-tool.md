# RLM Unknown Tool Snapshot Reload

RLM now reloads snapshots before injecting unknown-tool runtime errors in both:

- `rlmExecute` (module-level inline execution)
- `agentLoopRun` (agent loop inline execution)

This avoids calling `resume()` directly on a live snapshot object in the unknown-tool branch, matching the existing dump/load safety pattern used for normal tool-call resumes.

## Flow

```mermaid
flowchart TD
  A[Monty paused snapshot] --> B{Tool still registered?}
  B -->|Yes| C[Execute tool + snapshot dump/load + resume]
  B -->|No| D[Snapshot dump]
  D --> E[Snapshot load]
  E --> F[resume(exception RuntimeError ToolError Unknown tool)]
  F --> G[Continue VM or complete block]
```

## Additional hardening

`rlmStepToolCall` now copies `snapshot.dump()` into a fresh `Buffer` before persistence/resume handoff.
