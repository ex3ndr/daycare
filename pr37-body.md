## Fix: Stop inference after pending tool calls on restore

### Problem

When a server restarts while an agent has in-flight tool calls, `completePendingToolCalls()` in `agent.ts` calls `agentLoopRun` with `stopAfterPendingPhase: false`. This means after finishing the pending tool calls, it immediately starts a **new inference cycle** — but providers may not be fully initialized yet (they reload asynchronously during startup). This causes `Inference error: All providers are not available` crashes.

### Root Cause

In `agent.ts` line 1379, `completePendingToolCalls` passes `stopAfterPendingPhase: false` to `agentLoopRun`. The `false` value tells the loop to continue into inference after restoring tool calls, rather than stopping.

### Fix

Single line change:
```diff
- stopAfterPendingPhase: false
+ stopAfterPendingPhase: true
```

When an agent is restored after server restart, it now only finishes in-flight tool calls and **stops**. The next user message (or scheduled trigger) will naturally start inference when providers are guaranteed to be ready.

### Why not retry logic?

An earlier approach added retry/backoff in `agentLoopRun.ts` for provider unavailability. That treated the symptom, not the cause. The real issue is that post-restore agents shouldn't eagerly start new inference at all — they should just finish what was interrupted and wait. This is simpler, more correct, and doesn't add complexity to the inference loop.
