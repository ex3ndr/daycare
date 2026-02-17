# AgentSystem Poison-Pill Flake

The `agentSystem.spec.ts` poison-pill test was flaky because `postAndAwait(...)` can reject
as soon as `entry.terminating = true`, before the state file is persisted as `dead`.

## Race

```mermaid
sequenceDiagram
  participant T as Test
  participant S as AgentSystem
  participant A as Agent Loop
  participant F as State File

  T->>S: generate poison-pill
  S->>S: entry.terminating = true
  S->>A: enqueue system_message
  T->>S: postAndAwait(reset)
  S-->>T: reject "Agent is dead" (terminating gate)
  Note over S,A: markEntryDead may still be pending
  S->>F: write state=dead
```

## Stabilization

The test now waits for persisted state:

- use `vi.waitFor(...)` around `agentStateRead(...)`
- assert `state === "dead"` only after the async transition is complete

This removes timing-dependent failures (`sleeping` vs `dead`) and cleanup races.
