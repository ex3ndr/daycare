# Durable Function Calls

## Summary
- Added a shared durable function catalog in `packages/daycare/sources/durable/durableFunctions.ts`.
- Durable calls now have two modes:
  - outside durable execution: schedule and return immediately
  - inside durable execution: invoke durably and await the result
- Added a file-backed local durable queue with retry and restart recovery.
- Added Inngest-backed durable function execution using the same catalog and handlers.
- Routed delayed signal delivery through the durable layer as the smallest existing async boundary.

## Flow

```mermaid
flowchart TD
    A[Delayed signal becomes due] --> B{already pending?}
    B -->|yes| C[skip duplicate schedule]
    B -->|no| D[ctx.durable.invoke]
    D --> E{inside durable scope?}
    E -->|no| F[schedule durable function]
    E -->|yes| G[invoke durable function and await]
    F --> H{runtime}
    G --> H
    H -->|local| I[file queue + retry + restart recovery]
    H -->|inngest| J[event trigger or step.invoke]
    I --> K[shared durable executor]
    J --> K
    K --> L[DelayedSignals.deliver(ctx, delayedSignalId)]
    L --> M[generate signal]
    M --> N[delete delayed row]
```

## Notes
- The durable catalog owns function ids, event names, and schedule dedupe keys.
- Local durability recovers jobs by moving in-flight files back to pending on startup.
- Inngest durability reuses the same executor and supports nested calls via `step.invoke()`.
