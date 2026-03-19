# Durable Function Calls

## Summary
- Added a shared durable function catalog in `packages/daycare/sources/durable/durableFunctions.ts`.
- Durable functions now keep only `name`, `description`, role gating, and the typed handler.
- Inngest event names and function ids are derived from the durable function name instead of being stored in the catalog.
- Durable execution is now routed through two context methods:
  - `await ctx.durableCall(id, name, input)` schedules outside durable execution and invokes inline inside durable execution
  - `await ctx.durableStep(id, fn)` runs a durable step and throws outside durable execution
- Added a file-backed local durable queue with retry and restart recovery.
- Added Inngest-backed durable function execution using the same catalog and handlers.
- Routed delayed signal delivery through the durable layer as the smallest existing async boundary.
- `Context.durable` now carries runtime state (`kind`, `instanceId`, `executionId`) only for active durable executions and is not serialized.

## Flow

```mermaid
flowchart TD
    A[Delayed signal becomes due] --> B{already pending?}
    B -->|yes| C[skip duplicate schedule]
    B -->|no| D[ctx.durableCall]
    D --> E[resolve current durable instance]
    E --> H{runtime}
    H -->|local| I[file queue + retry + restart recovery]
    H -->|inngest| J[event trigger or step.invoke]
    I --> K[shared durable executor]
    J --> K
    K --> L[active ctx.durable includes instanceId + executionId]
    L --> M[ctx.durableStep or nested ctx.durableCall]
    M --> N[DelayedSignals.deliver(ctx, delayedSignalId)]
    N --> O[generate signal]
    O --> P[delete delayed row]
```

## Notes
- The durable catalog owns only the function name, description, role gating, and handler.
- Local durability recovers jobs by moving in-flight files back to pending on startup.
- `Context` is serialized directly with `contextToJSON()` / `Context.fromJSON()`; there is no separate durable snapshot type.
- The process keeps a small global durable registry keyed by runtime instance id.
- Inngest durability reuses the same executor and resolves live step state by `executionId`.
