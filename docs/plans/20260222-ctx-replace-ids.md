# Replace all userId/agentId with Context (ctx)

## Overview
Eliminate every remaining raw `userId`/`agentId` parameter and field from the API/logic layer. All operations start with a `ctx: Context` argument and carry it through to downstream calls. No backward compatibility, no fallback to owner/user resolution at call sites.

The `Context` class itself changes: `agentId` becomes optional (set via factory), but accessing it when unset throws. This allows user-only contexts (e.g., IPC memory routes) without a dummy agentId.

### Key problems solved
- Memory agent created with wrong userId because identity is resolved ad-hoc instead of carried via ctx
- Agent ops (`agentStateRead`, `agentDescriptorWrite`, etc.) accept raw `agentId` strings that can be mismatched
- `ToolVisibilityContext` and `AgentSystemPromptContext` use loose optional `userId?`/`agentId?` instead of ctx
- `CronTaskDefinition`/`CronTaskContext` carry raw userId/agentId instead of ctx
- `Memory` class methods take raw `userId` instead of ctx
- `MemoryWorker` does not carry any userId context
- Silent owner-fallback resolution in multiple places (`resolveUserIdForDescriptor`, `resolveUserIdForConnectorKey`, `agentDescriptorWrite`, `default user resolver` in Exposes/Processes) masks bugs — if userId is unknown, it should throw, not silently assign to owner

## Context (from discovery)

### Already migrated (previous plans, all complete)
- All repository `findMany(ctx)` methods
- Signal subscribe/unsubscribe types use `ctx: Context`
- Cron/heartbeat scheduler facade methods accept `ctx`
- `ToolExecutionContext.ctx` field
- `channels.addMember`/`removeMember` accept `ctx`
- Variable naming standardized to `ctx`

### Remaining raw userId/agentId to migrate
1. **Context class** — `agentId` is required; needs optional-with-throwing-getter
2. **Agent ops** — `agentPath`, `agentStateRead`, `agentStateWrite`, `agentHistoryAppend`, `agentHistoryLoad`, `agentHistoryLoadAll`, `agentDescriptorRead`, `agentDescriptorWrite` all take raw `agentId`
3. **Agent class** — constructor/create/restore take separate `agentId` + `userId`; stores `this.id` + `this.userId` separately
4. **AgentEntry** — holds `agentId` + `userId` as separate fields
5. **AgentSystem** — `resolveUserIdForDescriptor` returns raw string; `userHomeForUserId` takes raw string; `ownerUserIdEnsure` returns raw string
6. **Memory class** — all methods take raw `userId`
7. **MemoryWorker** — no ctx at all
8. **IPC memory routes** — extract userId from URL params
9. **ToolVisibilityContext** — raw `userId` + `agentId` strings
10. **AgentSystemPromptContext** — optional `userId?` + `agentId?`
11. **CronTaskDefinition/CronTaskContext** — raw `userId` + `agentId`
12. **SignalSource** — raw `userId` in each variant

### Owner-fallback paths to remove (NEVER silently assign to owner)
1. **`agentDescriptorWrite`** — fallback chain: existing userId → provided userId → find owner → create owner. Must be removed: ctx always carries resolved userId, no fallback
2. **`resolveUserIdForDescriptor`** — subagent/app falls back to `ownerUserIdEnsure()` when parent not found; default case falls back to owner. Must throw instead
3. **`resolveUserIdForConnectorKey`** — falls back to `ownerUserIdEnsure()` when connector lookup fails. Must throw instead
4. **`default user resolver`** in `engine.ts` — `async () => owner?.id ?? "owner"` passed to Exposes. Must be removed
5. **`Exposes.default user resolver`** — used when no userId override in `create()`. Must require ctx instead
6. **`Processes.default user resolver`** / legacy default-user accessor — returns `"owner"` literal or looks up owner. Must require ctx from caller
7. **`ownerUserIdEnsure()`** itself — still needed for engine startup (ensuring owner home dir exists), but must NOT be used as a fallback in identity resolution chains. Rename to `ownerCtxEnsure()` to return a `Context` and restrict usage to startup only

### Cross-user contamination vectors (found via audit)
1. **`post()`/`postAndAwait()`** — central routing with NO userId check. Any caller can send to any agent across users
2. **`agentFor(strategy)`** — returns most-recent matching agent across ALL users. Used by `sendUserMessageTool` as fallback — User A's agent could send to User B's foreground agent
3. **`agent_reset` tool** — takes arbitrary agentId, posts reset with no user check. User A can wipe User B's agent session
4. **`agent_compact` tool** — same pattern, posts compact to any agentId with no user check
5. **`sendUserMessageTool`** — uses unscoped `agentFor("most-recent-foreground")` which crosses user boundaries
6. **Heartbeat batching** — ALL users' heartbeat tasks batched into single `system:heartbeat` agent. User A's prompts visible in same inference context as User B's
7. **Cron task execution** — posts to `task.agentId` without verifying it belongs to the same user as `task.userId`
8. **`channel_create` tool** — accepts arbitrary `leaderAgentId` from LLM args, can create channel owned by different user
9. **Expose `list()`/`remove()`/`update()`** — no userId scoping. Any agent can list/remove/update any user's endpoints
10. **Process `list()`/`get()`/`stop()`/`remove()`** — no userId scoping after creation. Any agent can stop any user's processes
11. **Memory-agent always assigned to owner** — `resolveUserIdForDescriptor` default case falls back to owner for `memory-agent` type, so non-owner users' memory observations go to wrong memory graph

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- No backward compatibility shims — break old signatures, fix all callers
- DB record types keep flat `userId`/`agentId` strings (storage layer unchanged)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Redesign Context class with optional agentId
- [ ] Rewrite `context.ts`: constructor takes `{ userId: string; agentId?: string }`
- [ ] `userId` is a readonly property, always required
- [ ] `agentId` is a getter that throws `Error("Context has no agentId")` when not set
- [ ] Add `hasAgentId` boolean getter for safe checking
- [ ] Add factory `contextForUser({ userId })` — creates Context without agentId
- [ ] Add factory `contextForAgent({ userId, agentId })` — creates Context with agentId
- [ ] Export factories from `@/types`
- [ ] Write tests in `context.spec.ts` for: contextForUser, contextForAgent, agentId getter throws, hasAgentId
- [ ] Run tests — must pass before next task

### Task 2: Migrate agent ops to accept ctx instead of agentId
- [ ] `agentPath(config, ctx)` — use `ctx.agentId` internally
- [ ] `agentStateRead(storageOrConfig, ctx)` — use `ctx.agentId`
- [ ] `agentStateWrite(storageOrConfig, ctx, state)` — use `ctx.agentId`
- [ ] `agentHistoryAppend(storageOrConfig, ctx, record)` — use `ctx.agentId`
- [ ] `agentHistoryLoad(storageOrConfig, ctx)` — use `ctx.agentId`
- [ ] `agentHistoryLoadAll(storageOrConfig, ctx, limit?)` — use `ctx.agentId`
- [ ] `agentDescriptorRead(storageOrConfig, ctx)` — use `ctx.agentId`
- [ ] `agentDescriptorWrite(storage, ctx, descriptor, defaultPermissions)` — use `ctx.agentId` and `ctx.userId`; **remove the entire owner fallback chain** (no more find-owner/create-owner logic — ctx is authoritative)
- [ ] Update all callers of these ops in `agent.ts`, `agentSystem.ts`, `agentLoopRun.ts`, and any other files
- [ ] Write/update tests for changed ops
- [ ] Run tests — must pass before next task

### Task 3: Migrate Agent class to hold ctx instead of separate id/userId
- [ ] Replace `readonly id: string` + `readonly userId: string` with `readonly ctx: Context`
- [ ] Add getter `get id(): string` that returns `this.ctx.agentId` for compatibility during migration
- [ ] Update private constructor: accept `ctx: Context` instead of `id` + `userId`
- [ ] Update `Agent.create(ctx, descriptor, inbox, agentSystem, userHome)` — ctx carries both agentId and userId
- [ ] Update `Agent.restore(ctx, descriptor, state, inbox, agentSystem, userHome)` — same
- [ ] Update all internal references: `this.id` → `this.ctx.agentId`, `this.userId` → `this.ctx.userId`
- [ ] Update all places that construct `new Context(this.id, this.userId)` → just use `this.ctx`
- [ ] Update `agent.spec.ts`
- [ ] Run tests — must pass before next task

### Task 4: Migrate AgentEntry and AgentSystem to use ctx, remove owner fallbacks
- [ ] Replace `AgentEntry.agentId` + `AgentEntry.userId` with `AgentEntry.ctx: Context`
- [ ] Update `registerEntry` to accept ctx
- [ ] Update `resolveEntry` — construct ctx via `contextForAgent` from resolved userId + agentId, pass to `Agent.create`
- [ ] Update `restoreAgent` — construct ctx from DB record, pass to `Agent.restore`
- [ ] Update `contextForAgentId` — use factories
- [ ] Update `userHomeForUserId(userId)` → `userHomeForCtx(ctx)` using `ctx.userId` (or keep accepting userId since UserHome is a boundary)
- [ ] Update all AgentEntry field accesses throughout `agentSystem.ts` (`entry.agentId` → `entry.ctx.agentId`, `entry.userId` → `entry.ctx.userId`)
- [ ] **Remove owner fallback from `resolveUserIdForDescriptor`**: when parent agent not found for subagent/app, throw `Error("Parent agent not found")` instead of falling back to owner. Default case must also throw — every descriptor type must have an explicit resolution path
- [ ] **Remove owner fallback from `resolveUserIdForConnectorKey`**: when connector key lookup fails, throw `Error("User not found for connector key")` instead of falling back to owner
- [ ] **Rename `ownerUserIdEnsure()` → `ownerCtxEnsure()`**: return `contextForUser({ userId })` instead of raw string. Restrict usage to engine startup only (ensuring home dir). Remove all identity-resolution usages
- [ ] **`steer(ctx, agentId, steering)`**: change signature to accept caller's ctx as first arg. Verify `ctx.userId` matches the target agent's userId before delivering — throw if different user (no silent cross-user steering). Remove the `assertCrossUserAllowed` check from `background.ts` since `steer` now enforces it
- [ ] **`post(ctx, target, item)` and `postAndAwait(ctx, target, item)`**: add caller ctx as first arg. When target is `{ agentId }`, verify `ctx.userId` matches the resolved entry's userId — throw on mismatch. When target is `{ descriptor }`, the newly created agent inherits userId from descriptor resolution (already scoped). System-internal posts (cron, heartbeat, signal delivery, engine) pass the task's own ctx
- [ ] **`agentFor(ctx, strategy)`**: add ctx param, filter candidates to `entry.ctx.userId === ctx.userId` — prevents cross-user agent resolution (currently returns any user's agent)
- [ ] **Other AgentSystem entry-map lookups** (`markStopped`, `getAgentDescriptor`, `updateAgentDescriptor`, `updateAgentPermissions`, `updateAgentModelOverride`, `agentExists`): keep as `agentId` — these are internal self-operations or system-level lookups, not cross-agent user-scoped calls. Document as intentional
- [ ] Update `agentSystem.spec.ts`
- [ ] Run tests — must pass before next task

### Task 5: Migrate ToolVisibilityContext to use ctx
- [ ] Replace `userId: string` + `agentId: string` with `ctx: Context` in `ToolVisibilityContext`
- [ ] Update all construction sites in `agent.ts` and `agentLoopRun.ts`
- [ ] Update all consumers that read `visibilityContext.userId` / `visibilityContext.agentId` → `visibilityContext.ctx.userId` / `visibilityContext.ctx.agentId`
- [ ] Update tests
- [ ] Run tests — must pass before next task

### Task 6: Migrate AgentSystemPromptContext to use ctx
- [ ] Replace `userId?: string` + `agentId?: string` with `ctx: Context` (required) in `AgentSystemPromptContext`
- [ ] Update `agentSystemPrompt.ts` and all callers that build the context object
- [ ] Update all readers of `promptContext.userId` / `promptContext.agentId` → `promptContext.ctx.userId` / `promptContext.ctx.agentId`
- [ ] Update tests
- [ ] Run tests — must pass before next task

### Task 7: Migrate Memory class methods to accept ctx
- [ ] `resolveMemoryDir(ctx)` — use `ctx.userId`
- [ ] `readGraph(ctx)` — use `ctx.userId`
- [ ] `readNode(ctx, nodeId)` — use `ctx.userId`
- [ ] `writeNode(ctx, node)` — use `ctx.userId`
- [ ] `append(ctx, nodeId, content)` — use `ctx.userId`
- [ ] Update all callers: memory tools (`memoryNodeReadToolBuild`, `memoryNodeWriteToolBuild`), memory worker, memory session observe
- [ ] Update IPC `serverMemoryRoutesRegister` — construct `contextForUser({ userId })` from URL param, pass to Memory methods
- [ ] Update `MemoryRoutesRuntime` type to accept ctx
- [ ] Update tests
- [ ] Run tests — must pass before next task

### Task 8: Migrate CronTaskDefinition/CronTaskContext to use ctx
- [ ] Replace `userId: string` + `agentId?: string` with `ctx: Context` in `CronTaskDefinition`
- [ ] Replace `userId: string` + `agentId: string | null` with `ctx: Context` in `CronTaskContext`
- [ ] Update `cronTasksRepository` — build/extract ctx when reading/writing records
- [ ] Update `crons.ts` facade — carry ctx through
- [ ] Update `cronScheduler.ts` — construct ctx from DB record when firing
- [ ] Update cron tool callers
- [ ] Update tests
- [ ] Run tests — must pass before next task

### Task 9: Remove default user resolver from Exposes and Processes, remove contextUserIdResolve helpers
- [ ] **Exposes**: remove `default user resolver` option and field entirely. Change `create(input, userIdOverride?)` → `create(ctx, input)` — ctx provides userId, no fallback. Remove `normalizeUserId()` helper
- [ ] **Processes**: remove `default user resolver` field and legacy default-user accessor. Remove the `"owner"` literal string fallback
- [ ] **engine.ts**: remove the `default user resolver` lambda. Update Exposes/Processes construction — they no longer accept fallback functions
- [ ] **exposeCreateToolBuild.ts**: pass `toolContext.ctx` to `exposes.create(ctx, input)` instead of extracting `toolContext.ctx.userId`
- [ ] **permanentAgentToolBuild.ts**: remove `contextUserIdResolve()` helper — use `toolContext.ctx.userId` directly (ctx is always present, non-optional). Also update all `agentDescriptorWrite`/`agentStateRead`/`agentStateWrite` calls in this file to pass ctx
- [ ] **appInstallToolBuild.ts**: remove `contextUserIdResolve()` helper — use `toolContext.ctx.userId` directly
- [ ] Update all callers of `Exposes.create()` and process APIs to provide ctx
- [ ] Update tests for Exposes, Processes, permanentAgentToolBuild, appInstallToolBuild
- [ ] Run tests — must pass before next task

### Task 10: Add cross-user boundary checks to tools and facades
- [ ] **`agentResetTool`**: add userId check — verify target agent's userId matches `toolContext.ctx.userId` before posting reset. Throw on mismatch
- [ ] **`agentCompactTool`**: same — verify userId match before posting compact
- [ ] **`sendUserMessageTool`**: `agentFor()` now requires ctx (Task 4), so the fallback `agentFor(ctx, "most-recent-foreground")` is automatically user-scoped. Verify this works
- [ ] **`background.ts` (`send_agent_message`)**: remove `assertCrossUserAllowed()` since `post()` and `steer()` now enforce user boundaries at the AgentSystem level
- [ ] **`channel_create` tool**: verify `leaderAgentId` belongs to the calling agent's user before creating channel (use `toolContext.ctx.userId` to check)
- [ ] **Cron task execution** (`crons.ts`): when firing a task with `agentId`, verify `task.ctx.userId` matches the target agent's userId before posting (or pass task's ctx to `post()` which now enforces it)
- [ ] **Heartbeat execution** (`heartbeats.ts`): batch tasks per userId — each user's heartbeat tasks go to a separate `system:heartbeat` agent scoped to that user, not a single shared agent. Pass task ctx to `postAndAwait()`
- [ ] **Expose `list()`**: accept ctx, filter endpoints to `ctx.userId`. **`remove()`/`update()`**: accept ctx, verify endpoint's userId matches `ctx.userId` before operating
- [ ] **Process `list()`/`get()`/`stop()`/`remove()`**: accept ctx, filter/verify `record.userId === ctx.userId`. Process tools in `processTools.ts` must pass `toolContext.ctx`
- [ ] Update tests for all changed tools and facades
- [ ] Run tests — must pass before next task

### Task 11: Migrate SignalSource to use ctx
- [ ] Replace raw `userId: string` in each SignalSource variant with `ctx: Context` (using `contextForUser` for system/webhook/process sources without agentId, `contextForAgent` for agent sources)
- [ ] Update all SignalSource construction sites in signals, agent system, connectors
- [ ] Update all SignalSource consumers that read `.userId`
- [ ] Update tests
- [ ] Run tests — must pass before next task

### Task 12: Migrate MemoryWorker to carry ctx
- [ ] When MemoryWorker processes a session, look up the agent record and construct ctx via `contextForAgent`
- [ ] Pass ctx to the memory-agent descriptor construction
- [ ] Ensure the memory-agent inherits the correct userId via ctx (this is the root cause of the wrong-userId bug)
- [ ] Update tests
- [ ] Run tests — must pass before next task

### Task 13: Audit and remove all remaining raw userId/agentId parameters
- [ ] Grep for `userId: string` in function/method signatures (excluding DB record types in `databaseTypes.ts` and internal repository query option types) — should be zero
- [ ] Grep for `agentId: string` in function/method signatures (excluding DB record types and `contextForAgentId`) — should be zero
- [ ] Grep for `ctx\.?` (optional chaining on ctx) — replace all `ctx?.userId`, `ctx?.agentId` with `ctx.userId`, `ctx.agentId` since ctx is always present. Found in: `permanentAgentToolBuild.ts`, `appInstallToolBuild.ts`, `rlmToolsForContextResolve.ts`, `subuserListToolBuild.ts`, `subuserCreateToolBuild.ts`, `subuserConfigureToolBuild.ts`, `background.ts`, `delayedSignalsRepository.ts`
- [ ] Grep for `contextUserIdResolve` — should be zero (removed in Task 9)
- [ ] Grep for `fallback.*userId` and `ownerUserIdEnsure` — should only appear in `ownerCtxEnsure` and engine startup
- [ ] Grep for `?? "owner"` — should be zero (no more literal "owner" fallbacks)
- [ ] Grep for `userId?: string` and `agentId?: string` in non-DB type definitions — should be zero (excluding URL param casts in IPC routes and migration files)
- [ ] Remove any dead code or unused imports from migration
- [ ] Run tests — must pass before next task

### Task 14: Verify acceptance criteria
- [ ] Verify no function parameters accept separate `userId`/`agentId` where `ctx` should be used
- [ ] Verify no silent owner-fallback resolution exists (every resolution path either succeeds or throws)
- [ ] Verify no cross-user contamination vectors remain (all cross-agent operations check userId)
- [ ] Verify Context class has throwing getter for agentId
- [ ] Verify factory functions work correctly
- [ ] Verify memory agent receives correct userId through ctx
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`)
- [ ] Run type checker (`yarn typecheck`)
- [ ] Fix any lint/type issues

### Task 15: Update documentation
- [ ] Update `doc/internals/` ctx convention docs with new Context shape
- [ ] Add mermaid diagram showing ctx flow from agent creation through ops/memory/tools
- [ ] Document the "no fallback" rule: if userId cannot be determined, throw — never silently assign to owner
- [ ] Document the cross-user boundary enforcement: every cross-agent operation verifies userId match

## Technical Details

### Context class (new shape)
```typescript
// context.ts
export class Context {
    readonly userId: string;
    private readonly _agentId: string | undefined;

    private constructor(userId: string, agentId?: string) {
        this.userId = userId;
        this._agentId = agentId;
    }

    get agentId(): string {
        if (this._agentId === undefined) {
            throw new Error("Context has no agentId");
        }
        return this._agentId;
    }

    get hasAgentId(): boolean {
        return this._agentId !== undefined;
    }
}

/** Creates a user-only context (agentId throws on access). */
export function contextForUser(args: { userId: string }): Context { ... }

/** Creates a full agent+user context. */
export function contextForAgent(args: { userId: string; agentId: string }): Context { ... }
```

### Agent class (before → after)
```typescript
// Before
static async create(agentId, descriptor, userId, inbox, agentSystem, userHome)
// After
static async create(ctx, descriptor, inbox, agentSystem, userHome)

// Before
this.id  // agentId
this.userId
new Context(this.id, this.userId)
// After
this.ctx.agentId
this.ctx.userId
this.ctx  // pass directly
```

### Agent ops (before → after)
```typescript
// Before
agentStateRead(storage, agentId)
agentDescriptorWrite(storage, agentId, descriptor, userId, permissions)
// After
agentStateRead(storage, ctx)
agentDescriptorWrite(storage, ctx, descriptor, permissions)
```

### Memory (before → after)
```typescript
// Before
memory.readGraph(userId)
memory.readNode(userId, nodeId)
// After
memory.readGraph(ctx)
memory.readNode(ctx, nodeId)
```

### IPC memory routes (before → after)
```typescript
// Before
runtime.memory.readGraph(userId)
// After
const ctx = contextForUser({ userId });
runtime.memory.readGraph(ctx)
```

## Post-Completion

**Manual verification:**
- Verify memory agent receives correct userId (not every-file userId) by running a memory observation cycle
- Verify agent creation → tool execution → memory write flow carries same ctx throughout
- Verify IPC memory API still works with contextForUser construction
- Verify cron/heartbeat task execution carries correct ctx
- Verify that creating an agent with an unknown parent throws (not silently assigns to owner)
- Verify that connector key lookup failure throws (not silently assigns to owner)
- Verify expose creation without userId throws (not silently assigns to owner)
