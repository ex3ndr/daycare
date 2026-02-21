# Replace remaining userId/agentId parameters with ctx

## Overview
Complete the ctx migration started in the `agent-context-to-context` plan. All function/method parameters that accept separate `userId` and/or `agentId` strings should accept a `Context` object (`ctx`) instead. This eliminates scattered identity parameters and ensures every operation flows through a single typed context.

**Scope**: Function/method parameters and input types only. Internal record fields (`AgentEntry.userId`, DB records, `SignalSource.userId`) stay as-is because they represent stored/serialized data.

## Context (from discovery)

### Already migrated
- All repository `findMany(ctx)` methods
- `signalSubscriptionsRepository.delete(ctx, pattern)`, `findByUserAndAgent(ctx, pattern)`, `findMatching(ctx, signalType)`
- Cron/heartbeat scheduler methods (`addTask(ctx, ...)`, `deleteTask(ctx, ...)`)
- `ToolExecutionContext.ctx` field
- Variable naming convention (`ctx` everywhere)

### Remaining references to migrate

**Signal types** (highest impact — used by channels, tools, tests):
- `SignalSubscribeInput` — `{ userId, agentId, pattern, silent? }` → `{ ctx, pattern, silent? }`
- `SignalUnsubscribeInput` — `{ userId, agentId, pattern }` → `{ ctx, pattern }`
- `SignalSubscription` — `{ userId, agentId, pattern, ... }` → `{ ctx, pattern, ... }`
- `signalSubscriptionInputNormalize()` in `signals.ts` — accepts `{ userId, agentId, pattern }`

**Channels facade** (`channels.ts`):
- `addMember(channelName, agentId, username)` → `addMember(channelName, ctx, username)`
- `removeMember(channelName, agentId)` → `removeMember(channelName, ctx)`
- `contextFromUserId()` helper

**Agent system** (`agentSystem.ts`):
- `agentExists(agentId)` — lookup by agentId (no userId needed, keep as-is)
- `contextForAgentId(agentId)` — creates ctx from agentId (keep as-is, this is the factory)
- `steer(agentId, steering)` — could accept ctx but operates on loaded entries by agentId (keep as-is)

**Delayed signals repository** (`delayedSignalsRepository.ts`):
- `findAll(userId?)` → `findAll(ctx?)` for consistency
- `deleteByRepeatKey(userId, type, repeatKey)` → `deleteByRepeatKey(ctx, type, repeatKey)`

**Delayed signals facade** (`delayedSignals.ts`):
- `schedule()` extracts `userId` from `source.userId` — internal, stays
- `cancelByRepeatKey()` uses repeat key matching, no userId param — stays

**Users repository** (`usersRepository.ts`):
- `addConnectorKey(userId, connectorKey)` — operates on user identity directly, not ctx-scoped (keep as-is)

**Storage utility** (`userConnectorKeyCreate.ts`):
- `userConnectorKeyCreate(connector, userId)` — creates a key string, not ctx-scoped (keep as-is)

**IPC client** (`engine/ipc/client.ts`):
- `addEngineChannelMember(channelName, agentId, username)` — CLI boundary, passes agentId over HTTP
- `removeEngineChannelMember(channelName, agentId)` — CLI boundary, passes agentId over HTTP

**CLI commands** (`commands/channelAddMember.ts`, `commands/channelRemoveMember.ts`):
- Accept agentId from CLI args — boundary layer, keep as-is

**Signal subscribe/unsubscribe tools** (`signalSubscribeToolBuild.ts`, `signalUnsubscribeToolBuild.ts`):
- Currently construct `{ userId: ctx.userId, agentId: targetAgentId, pattern }` — will simplify to `{ ctx, pattern }`

### Decision: what stays as-is
- `AgentSystem.agentExists(agentId)` — pure agentId lookup, no user scoping needed
- `AgentSystem.contextForAgentId(agentId)` — factory that creates ctx
- `AgentSystem.steer(agentId, steering)` — operates on loaded entries by agentId
- `UsersRepository.addConnectorKey(userId, connectorKey)` — user identity management, not ctx-scoped
- `userConnectorKeyCreate(connector, userId)` — pure key builder
- CLI commands and IPC client — boundary layer, accepts raw strings from HTTP/CLI
- `SignalSource.userId` — serialized data field, not a parameter
- `subscriptionKeyBuild()` — internal helper, can take ctx
- DB record types — stored data

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Migrate SignalSubscribeInput and SignalUnsubscribeInput types to use ctx
- [x] Update `SignalSubscribeInput` in `signalTypes.ts`: replace `userId: string; agentId: string` with `ctx: Context` (keep `pattern`, `silent?`)
- [x] Update `SignalUnsubscribeInput` in `signalTypes.ts`: replace `userId: string; agentId: string` with `ctx: Context`
- [x] Update `SignalSubscription` in `signalTypes.ts`: replace `userId: string; agentId: string` with `ctx: Context`
- [x] Update `signalSubscriptionInputNormalize()` in `signals.ts` to accept `{ ctx: Context; pattern: string }` and normalize `ctx.userId`/`ctx.agentId` directly
- [x] Update `signalSubscriptionBuild()` in `signals.ts` to construct `{ ctx: { userId, agentId }, ... }` from DB records
- [x] Update `subscribe()` in `signals.ts` — use `ctx` from normalized input
- [x] Update `subscriptionGet()` in `signals.ts` — use `ctx` from normalized input
- [x] Update `unsubscribe()` in `signals.ts` — use `ctx` from normalized input
- [x] Update `contextFromUserId()` helper to return a proper `Context`
- [x] Write/update tests in `signals.spec.ts` for subscribe/unsubscribe with ctx-based input
- [x] Run tests — must pass before next task

### Task 2: Update all callers of signals.subscribe() and signals.unsubscribe()
- [x] Update `signalSubscribeToolBuild.ts` — pass `{ ctx, pattern, silent }` instead of `{ userId, agentId, pattern, silent }`
- [x] Update `signalUnsubscribeToolBuild.ts` — pass `{ ctx, pattern }` instead of `{ userId, agentId, pattern }`
- [x] Update `channels.ts` load() — pass `{ ctx: memberContext, pattern, silent }` to subscribe
- [x] Update `channels.ts` delete() — pass `{ ctx: memberContext, pattern }` to unsubscribe
- [x] Update `channels.ts` addMember() — pass `{ ctx: memberContext, pattern, silent }` to subscribe
- [x] Update `channels.ts` removeMember() — pass `{ ctx: memberContext, pattern }` to unsubscribe
- [x] Update `signalSubscribeToolBuild.spec.ts` — update test subscribe/unsubscribe calls
- [x] Update `signalUnsubscribeToolBuild.spec.ts` — update test subscribe/unsubscribe calls
- [x] Update `agent.spec.ts` — update subscribe/unsubscribe calls in signal-related tests
- [x] Run tests — must pass before next task

### Task 3: Update SignalSubscription consumers (agentSystem.signalDeliver)
- [x] Update `agentSystem.ts` `signalDeliver()` — access `subscription.ctx.agentId` and `subscription.ctx.userId` instead of `subscription.agentId`/`subscription.userId`
- [x] Update `signals.spec.ts` — any test assertions that reference `subscription.userId`/`subscription.agentId` → `subscription.ctx.userId`/`subscription.ctx.agentId`
- [x] Run tests — must pass before next task

### Task 4: Migrate Channels.addMember and removeMember to accept ctx
- [x] Change `addMember(channelName, agentId, username)` → `addMember(channelName, ctx: Context, username)` in `channels.ts`
- [x] Inside `addMember`, use `ctx.agentId` instead of `agentId` parameter; use `ctx.userId` for scope validation; remove `agentSystem.contextForAgentId()` call (caller provides ctx)
- [x] Change `removeMember(channelName, agentId)` → `removeMember(channelName, ctx: Context)` in `channels.ts`
- [x] Inside `removeMember`, use `ctx.agentId` instead of `agentId`; remove `agentSystem.contextForAgentId()` call
- [x] Update `ChannelsOptions.agentSystem` pick type review — `contextForAgentId` kept because `load`, `delete`, `create`, `getHistory`, and `send` still depend on it
- [x] Update IPC server handler that calls `addMember`/`removeMember` — construct ctx from agentId via `agentSystem.contextForAgentId()` before calling
- [x] Update `channelMemberTool.ts` (the tool that calls addMember/removeMember) — pass ctx
- [x] Update `channels.spec.ts` or `channelMemberTool.spec.ts` tests
- [x] Run tests — must pass before next task

### Task 5: Migrate delayedSignalsRepository.deleteByRepeatKey to accept ctx
- [x] Change `deleteByRepeatKey(userId, type, repeatKey)` → `deleteByRepeatKey(ctx: Context, type, repeatKey)` in `delayedSignalsRepository.ts`
- [x] Use `ctx.userId` inside the method for the SQL query and cache filtering
- [x] Update caller in `delayedSignals.ts` `schedule()` method — construct ctx from `userId` and pass it
- [x] Update `delayedSignalsRepository.spec.ts` — update test calls
- [x] Run tests — must pass before next task

### Task 6: Migrate delayedSignalsRepository.findAll to accept optional ctx
- [x] Change `findAll(userId?: string)` → `findAll(ctx?: Context)` in `delayedSignalsRepository.ts`
- [x] Use `ctx?.userId` inside the method for the optional user-scoped query
- [x] Update `findMany(ctx)` to call `findAll(ctx)` passing ctx through
- [x] Update caller in `delayedSignals.ts` `loadUnlocked()` — calls `findAll()` with no args (stays the same)
- [x] Update `delayedSignalsRepository.spec.ts` — update test calls
- [x] Run tests — must pass before next task

### Task 7: Clean up subscriptionKeyBuild internal helper
- [x] Change `subscriptionKeyBuild(userId, agentId, pattern)` → `subscriptionKeyBuild(ctx: Context, pattern)` in `signalSubscriptionsRepository.ts`
- [x] Use `ctx.userId` and `ctx.agentId` inside
- [x] Update all callers within the repository
- [x] Run tests — must pass before next task

### Task 8: Verify acceptance criteria
- [x] Verify no function/method parameters accept separate `userId`/`agentId` where `ctx` should be used (grep for function signatures)
- [x] Verify `SignalSubscribeInput`, `SignalUnsubscribeInput`, `SignalSubscription` use `ctx`
- [x] Verify `channels.addMember`/`removeMember` accept `ctx`
- [x] Verify `delayedSignalsRepository.deleteByRepeatKey` and `findAll` accept `ctx`
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run type checker (`yarn typecheck`)
- [x] Fix any lint/type issues

### Task 9: Update documentation
- [x] Update `doc/internals/signal-subscriptions-ctx-normalization.md` to reflect new types
- [x] Add doc in `doc/internals/` describing the ctx parameter convention with mermaid diagram

## Technical Details

### SignalSubscribeInput (before → after)
```typescript
// Before
type SignalSubscribeInput = {
    userId: string;
    agentId: string;
    pattern: string;
    silent?: boolean;
};

// After
type SignalSubscribeInput = {
    ctx: Context;
    pattern: string;
    silent?: boolean;
};
```

### SignalSubscription (before → after)
```typescript
// Before
type SignalSubscription = {
    userId: string;
    agentId: string;
    pattern: string;
    silent: boolean;
    createdAt: number;
    updatedAt: number;
};

// After
type SignalSubscription = {
    ctx: Context;
    pattern: string;
    silent: boolean;
    createdAt: number;
    updatedAt: number;
};
```

### Channels.addMember (before → after)
```typescript
// Before
async addMember(channelName: string, agentId: string, username: string): Promise<Channel>

// After
async addMember(channelName: string, ctx: Context, username: string): Promise<Channel>
```

### DelayedSignalsRepository.deleteByRepeatKey (before → after)
```typescript
// Before
async deleteByRepeatKey(userId: string, type: string, repeatKey: string): Promise<number>

// After
async deleteByRepeatKey(ctx: Context, type: string, repeatKey: string): Promise<number>
```

## Post-Completion

**Manual verification:**
- Verify signal subscribe/unsubscribe flow works end-to-end
- Verify channel member add/remove works through CLI and tools
- Verify delayed signal scheduling and cancellation works correctly
