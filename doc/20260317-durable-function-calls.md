# Durable Function Calls

## Summary
- Added a shared durable function catalog in `packages/daycare/sources/durable/durableFunctions.ts`.
- Durable functions are defined like tool definitions: `name`, `description`, typed input/output, role gating, and handler live together.
- Durable calls now have two modes:
  - `ctx.durable` missing: schedule and return immediately
  - `ctx.durable.active === true`: call durably and await the result
- Added a file-backed local durable queue with retry and restart recovery.
- Added Inngest-backed durable function execution using the same catalog and handlers.
- Routed delayed signal delivery through the durable layer as the smallest existing async boundary.

## Flow

```mermaid
flowchart TD
    A[Delayed signal becomes due] --> B{already pending?}
    B -->|yes| C[skip duplicate schedule]
    B -->|no| D[durable.schedule]
    D --> H{runtime}
    H -->|local| I[file queue + retry + restart recovery]
    H -->|inngest| J[event trigger or step.invoke]
    I --> K[shared durable executor]
    J --> K
    K --> L[bind ctx.durable to runtime]
    L --> M[durable.call inside durable code]
    M --> N[DelayedSignals.deliver(ctx, delayedSignalId)]
    N --> O[generate signal]
    O --> P[delete delayed row]
```

## Notes
- The durable catalog owns function ids, event names, descriptions, role gating, and handlers.
- Local durability recovers jobs by moving in-flight files back to pending on startup.
- `Context` is serialized directly with `contextToJSON()` / `Context.fromJSON()`; there is no separate durable snapshot type.
- Inngest durability reuses the same executor and supports nested calls via `step.invoke()`.
