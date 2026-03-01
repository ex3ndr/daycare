# Deferred Tool Message Sending

## Overview
Add a general-purpose deferred execution mechanism to `ToolDefinition` so that message-sending tools (`say`, `send_file`, `send_user_message`, `send_agent_message`, `friend_send`, `channel_send`) can defer their side effects until a Python block completes successfully. If the script fails, deferred sends are discarded. Tools get a `now: boolean` parameter for immediate sending when needed. Python output includes a status line indicating whether messages were sent or not.

## Problem
Currently, when Python code calls `say("hello")`, the message is sent immediately via the connector — even if the script later crashes. This leads to partial/orphaned messages being delivered on script failure. The desired behavior is: validate eagerly, send lazily (only on success).

## Context
- Tools affected: `say`, `send_file`, `send_user_message`, `send_agent_message`, `friend_send`, `channel_send`
- Deferral applies only during `pythonExecution: true` context (RLM/Monty VM)
- The `pythonExecution` flag already exists on `ToolExecutionContext`
- Tool results flow: `rlmStepToolCall` → accumulate in `tool_call` phase → `block_complete` phase flushes
- Key files:
  - `sources/engine/modules/tools/types.ts` — `ToolDefinition`, `ToolExecutionResult`
  - `sources/engine/modules/rlm/rlmStepToolCall.ts` — tool execution during Python
  - `sources/engine/agents/ops/agentLoopRun.ts` — phase state machine
  - `sources/engine/modules/tools/sayTool.ts`
  - `sources/engine/modules/tools/send-file.ts`
  - `sources/engine/modules/tools/sendUserMessageTool.ts`
  - `sources/engine/modules/tools/background.ts` (`send_agent_message`)
  - `sources/engine/modules/tools/friendSendToolBuild.ts`
  - `sources/engine/modules/tools/channelSendTool.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change
- Maintain backward compatibility (non-Python tool calls unaffected)

## Testing Strategy
- Unit tests for deferred execution flush/discard logic
- Unit tests for each modified tool (deferred vs immediate modes)
- Unit tests for the `now` flag bypass

## Implementation Steps

### Task 1: Add deferred types to ToolDefinition and ToolExecutionResult
- [ ] In `sources/engine/modules/tools/types.ts`, add `deferredPayload?: unknown` field to `ToolExecutionResult`
- [ ] In `sources/engine/modules/tools/types.ts`, add `executeDeferred?: (payload: unknown, context: ToolExecutionContext) => Promise<void>` to `ToolDefinition`
- [ ] Run typecheck to verify types are compatible
- [ ] No tests needed — type-only change, verified by typecheck

### Task 2: Capture deferred payloads in rlmStepToolCall
- [ ] In `sources/engine/modules/rlm/rlmStepToolCall.ts`, add `deferredPayload?: unknown` to `RlmStepToolCallResult`
- [ ] After tool execution succeeds (line ~95), extract `toolResult.deferredPayload` and include in step result
- [ ] Write test for `rlmStepToolCall` verifying deferredPayload is passed through
- [ ] Run tests — must pass before next task

### Task 3: Accumulate and flush deferred payloads in agentLoopRun
- [ ] In `agentLoopRun.ts` `tool_call` phase, accumulate `{ toolName, deferredPayload }` entries in a list scoped to the block
- [ ] Create `sources/engine/modules/rlm/rlmDeferredFlush.ts` — function that takes deferred entries + tool resolver, looks up each tool's `executeDeferred`, and calls it
- [ ] In `block_complete` phase (success path), call flush function; on error paths, discard the list
- [ ] Append status text to block result output: `"\n\n[Messages: N sent]"` on success or `"\n\n[Messages: N NOT sent (script failed)]"` on failure/discard
- [ ] Include the deferred count in the `block_complete` result tracking (printOutput or output string)
- [ ] Write test for `rlmDeferredFlush` (success flush and error discard)
- [ ] Run tests — must pass before next task

### Task 4: Defer `say` tool
- [ ] Add `now: Type.Optional(Type.Boolean())` to `say` tool schema
- [ ] Define a deferred payload type (connector, targetId, text, replyToMessageId)
- [ ] In `execute`: if `context.pythonExecution && !payload.now`, validate but return deferredPayload instead of calling `connector.sendMessage()`
- [ ] Add `executeDeferred` handler that performs `connector.sendMessage()` using the payload
- [ ] Non-Python calls and `now: true` calls continue sending immediately
- [ ] Write tests: deferred mode returns payload without sending, immediate mode sends, `now` flag bypasses deferral
- [ ] Run tests — must pass before next task

### Task 5: Defer `send_file` tool
- [ ] Add `now: Type.Optional(Type.Boolean())` to `send_file` schema
- [ ] Define deferred payload type (connector source, targetId, file reference, sendAs, text)
- [ ] In `execute`: if `context.pythonExecution && !payload.now`, validate + resolve file but return deferredPayload instead of calling `connector.sendMessage()`
- [ ] Add `executeDeferred` handler
- [ ] Write tests: deferred vs immediate behavior
- [ ] Run tests — must pass before next task

### Task 6: Defer `send_user_message` tool
- [ ] Add `now: Type.Optional(Type.Boolean())` to schema
- [ ] Define deferred payload (resolved target agent ID, wrapped text, origin, ctx userId, swarm info if applicable)
- [ ] In `execute`: if `context.pythonExecution && !payload.now`, validate + resolve target but return deferredPayload instead of calling `agentSystem.post()`
- [ ] Add `executeDeferred` handler that performs `agentSystem.post()` or `agentSystem.postAndAwait()` using the payload
- [ ] Handle the swarm `wait` case: if `wait: true`, cannot defer (must send immediately since we need the response); document this behavior
- [ ] Write tests: deferred vs immediate, swarm wait bypass
- [ ] Run tests — must pass before next task

### Task 7: Defer `send_agent_message` tool
- [ ] Add `now: Type.Optional(Type.Boolean())` to schema
- [ ] Define deferred payload (resolved target, delivery context userId, text, origin, steering flag, swarm contact info)
- [ ] In `execute`: if `context.pythonExecution && !payload.now`, validate + resolve target but return deferredPayload
- [ ] Handle steering: if `steering: true`, must send immediately (interrupts are time-sensitive); auto-bypass deferral
- [ ] Add `executeDeferred` handler
- [ ] Write tests: deferred vs immediate, steering bypass
- [ ] Run tests — must pass before next task

### Task 8: Defer `friend_send` tool
- [ ] Add `now: Type.Optional(Type.Boolean())` to schema
- [ ] Define deferred payload (target user ID, message item, nametag)
- [ ] In `execute`: if `context.pythonExecution && !payload.now`, validate friendship but return deferredPayload
- [ ] Add `executeDeferred` handler
- [ ] Write tests: deferred vs immediate
- [ ] Run tests — must pass before next task

### Task 9: Defer `channel_send` tool
- [ ] Add `now: Type.Optional(Type.Boolean())` to schema
- [ ] Define deferred payload (ctx, channelName, senderUsername, text, mentions)
- [ ] In `execute`: if `context.pythonExecution && !payload.now`, validate channel access but return deferredPayload
- [ ] Add `executeDeferred` handler
- [ ] Write tests: deferred vs immediate
- [ ] Run tests — must pass before next task

### Task 10: Verify acceptance criteria
- [ ] Verify all 6 sending tools support deferral during pythonExecution
- [ ] Verify `now: true` bypasses deferral for all tools
- [ ] Verify edge cases: steering auto-bypass, swarm wait auto-bypass
- [ ] Verify status message appears in Python output
- [ ] Run full test suite (unit tests)
- [ ] Run linter — all issues must be fixed

### Task 11: [Final] Update documentation
- [ ] Add a section to `doc/PLUGINS.md` about the deferred execution pattern
- [ ] Update the monty-python plugin README if it exists

## Technical Details

### Type Changes

```typescript
// ToolExecutionResult — new optional field
export type ToolExecutionResult<TResult = ToolResultObject> = {
    toolMessage: ToolResultMessage;
    typedResult: TResult;
    skipTurn?: boolean;
    deferredPayload?: unknown;  // NEW: serializable data for deferred execution
};

// ToolDefinition — new optional handler
export type ToolDefinition<TParams, TResult> = {
    tool: Tool<TParams>;
    returns: ToolResultContract<TResult>;
    execute: (...) => Promise<ToolExecutionResult<TResult>>;
    executeDeferred?: (payload: unknown, context: ToolExecutionContext) => Promise<void>;  // NEW
    visibleByDefault?: (...) => boolean;
};
```

### Deferred Payload Example (say tool)

```typescript
type SayDeferredPayload = {
    connector: string;
    targetId: string;
    text: string;
    replyToMessageId?: string;
};
```

### Flush Function

```typescript
// rlmDeferredFlush.ts
type DeferredEntry = {
    toolName: string;
    deferredPayload: unknown;
};

async function rlmDeferredFlush(
    entries: DeferredEntry[],
    toolResolver: ToolResolverApi,
    context: ToolExecutionContext
): Promise<number>;
```

### Status Message Format

On success: `\n\n[Messages: 3 sent]`
On failure: `\n\n[Messages: 2 NOT sent (script failed)]`
On zero deferred: no extra message

### Auto-Bypass Rules

Some operations cannot be deferred because they need immediate results:
- `send_user_message` with `wait: true` (blocks for swarm response)
- `send_agent_message` with `steering: true` (time-sensitive interrupt)

These send immediately regardless of `pythonExecution` context, same as `now: true`.

## Post-Completion

**Manual verification:**
- Test with a real Python script calling `say()` — verify message only appears after script succeeds
- Test script failure path — verify message is NOT sent
- Test `now=True` flag from Python — verify immediate delivery
- Verify non-Python tool calls (direct LLM inference) are completely unaffected
