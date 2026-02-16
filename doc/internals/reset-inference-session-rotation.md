# Reset Inference Session Rotation

Reset now rotates each agent's provider-facing inference session key.

## Why
- Some providers keep server-side/session-level cache behavior when the same session key is reused.
- Before this change, Daycare always used `agentId` as the provider session key.
- After `/reset`, context on disk was cleared, but provider session affinity could still influence the first reply.

## Change
- Added `inferenceSessionId` to persisted `AgentState`.
- Agent inference calls now use `state.inferenceSessionId` (falling back to `agentId` for older state payloads).
- `Agent.handleReset()` rotates `inferenceSessionId` with a new value before persisting state.
- Permanent agent creation also initializes `inferenceSessionId`.

## Flow
```mermaid
flowchart LR
  A[Agent active session key S1] --> B[/reset]
  B --> C[Clear local context]
  C --> D[Rotate key S1 -> S2]
  D --> E[Persist state.json]
  E --> F[Next inference call uses S2]
  F --> G[Provider session affinity isolated from pre-reset session]
```
