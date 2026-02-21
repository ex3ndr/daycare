# Signal Subscription Context Normalization

## Summary
Signal subscription APIs now use `ctx` for identity inputs and outputs:
- `SignalSubscribeInput` and `SignalUnsubscribeInput` accept `{ ctx, pattern }`.
- `SignalSubscription` exposes `{ ctx, pattern, silent, createdAt, updatedAt }`.
- Repository keying helpers build keys from `ctx` instead of separate `userId` / `agentId` params.

## Behavior
- `signals.subscribe({ ctx, pattern, silent })` normalizes `ctx.userId` and `ctx.agentId` before persistence.
- `signals.subscriptionGet({ ctx, pattern })` and `signals.unsubscribe({ ctx, pattern })` use the same normalized key path.
- `signalSubscriptionBuild(record)` maps DB fields to `subscription.ctx`.
- `signalSubscriptionsRepository.subscriptionKeyBuild(ctx, pattern)` is the canonical key builder.

## Flow
```mermaid
flowchart TD
  A[signals.subscribe input: ctx + pattern] --> B[signalSubscriptionInputNormalize]
  B --> C[ctx.userId/ctx.agentId trimmed and validated]
  C --> D[signalSubscriptions.findByUserAndAgent ctx pattern]
  D --> E[create or update DB record user_id + agent_id + pattern]
  E --> F[signalSubscriptionBuild record -> subscription.ctx]

  G[signals.unsubscribe input: ctx + pattern] --> H[signalSubscriptions.delete ctx pattern]
  H --> I[subscriptionKeyBuild ctx pattern]
```
