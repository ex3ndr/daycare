# Agent Context Restore

Agent `state.json` now stores `context.messages` so restart can keep a durable context snapshot.
On restore, history reconstruction still takes priority, but an empty history load no longer wipes the persisted context.

```mermaid
flowchart LR
  A[Agent handles message] --> B[Write state.json with context]
  B --> C[Engine restart]
  C --> D[Read state.json context snapshot]
  D --> E[Load history.jsonl tail]
  E --> F{History messages available?}
  F -- yes --> G[Use rebuilt history context]
  F -- no --> H[Keep persisted context snapshot]
```
