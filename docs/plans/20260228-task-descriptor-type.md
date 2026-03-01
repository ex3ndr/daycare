# Add `task` Descriptor Type

## Overview
Add a new `AgentDescriptor` variant `{ type: "task"; id: string }` that creates a dedicated, persistent agent per task ID. This becomes the **default descriptor** for all trigger systems (cron, heartbeat, webhook) when no explicit `agentId` is specified — replacing the current `{ type: "system", tag: "..." }` fallback.

**Problem:** Today, tasks without an explicit `agentId` route to shared system agents (`system:cron`, `system:heartbeat`, `system:webhook`). This means unrelated tasks share conversation history and context, which is undesirable.

**Key benefit:** Each task gets its own persistent agent with isolated conversation history, keyed by task ID. The agent is reused across trigger invocations of the same task.

## Context (from discovery)
- Descriptor union type: `sources/engine/agents/ops/agentDescriptorTypes.ts`
- Cache key builder: `sources/engine/agents/ops/agentDescriptorCacheKey.ts`
- Label builder: `sources/engine/agents/ops/agentDescriptorLabel.ts`
- Role resolver: `sources/engine/agents/ops/agentDescriptorRoleResolve.ts`
- Strategy matcher: `sources/engine/agents/ops/agentDescriptorMatchesStrategy.ts`
- Agent resolution: `sources/engine/agents/agentSystem.ts` (lines 573–660)
- Cron default: `sources/engine/cron/crons.ts` (line 42) — `{ type: "system", tag: "cron" }`
- Heartbeat default: `sources/engine/heartbeat/heartbeats.ts` (line 49) — `{ type: "system", tag: "heartbeat" }`
- Webhook default: `sources/engine/webhook/webhooks.ts` (line 125) — `{ type: "system", tag: "webhook" }`
- Model role keys: `sources/settings.ts` (line 38) — add `"task"` to `ModelRoleKey`
- Role labels/keys: `sources/commands/models.ts` (lines 34–42)
- Cache key tests: `sources/engine/agents/ops/agentDescriptorCacheKey.spec.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility

## Testing Strategy
- **Unit tests**: required for every task — test each descriptor utility function with the new `task` type

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `task` descriptor variant to the union type
- [x] Add `| { type: "task"; id: string }` to `AgentDescriptor` in `agentDescriptorTypes.ts`
- [x] Add `"task"` to `ModelRoleKey` union in `settings.ts`
- [x] Run typecheck (`yarn typecheck`) to identify all exhaustiveness errors — these reveal every switch/if-chain that needs updating

### Task 2: Update descriptor utility functions
- [x] Add `case "task": return "/task/${descriptor.id}"` in `agentDescriptorCacheKey.ts`
- [x] Add `if (descriptor.type === "task") return "task ${descriptor.id}"` in `agentDescriptorLabel.ts`
- [x] Add `case "task": return "task"` in `agentDescriptorRoleResolve.ts`
- [x] Confirm `agentDescriptorMatchesStrategy.ts` needs no changes (task matches neither strategy — returns false by default)
- [x] Confirm `agentDescriptorIsHeartbeat.ts` needs no changes (only checks for heartbeat)
- [x] ➕ Update `channelSendTool.ts` sender username resolution to handle `task` descriptors
- [x] Write test for `agentDescriptorCacheKey` with task descriptor in `agentDescriptorCacheKey.spec.ts`
- [x] Run tests — must pass before next task

### Task 3: Update agent resolution for task descriptors
- [x] In `agentSystem.ts` `resolveEntry()`, extend the cron-specific cuid2 ID reuse logic (lines 618–638) to also cover `descriptor.type === "task"` — so task agents persist by ID across invocations
- [x] Run tests — must pass before next task

### Task 4: Update trigger systems to use task descriptor as default
- [x] In `crons.ts` (line 42): change fallback from `{ type: "system", tag: "cron" }` to `{ type: "task", id: task.taskId }`  where `task.taskId` is the task ID from the cron trigger
- [x] In `heartbeats.ts` (line 49): change fallback from `{ type: "system", tag: "heartbeat" }` to `{ type: "task", id: taskId }` — note: heartbeat batches multiple tasks per user, so each task in the batch should use its own task descriptor (may require restructuring the batch to post per-task instead of per-user)
- [x] In `webhooks.ts` (line 125): change fallback from `{ type: "system", tag: "webhook" }` to `{ type: "task", id: trigger.taskId }`
- [x] Run tests — must pass before next task

### Task 5: Update model role configuration
- [x] Add `task: "Task agents"` to `ROLE_LABELS` in `commands/models.ts` (line 34)
- [x] Add `"task"` to `ROLE_KEYS` array in `commands/models.ts` (line 42)
- [x] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [x] Run `yarn typecheck` — no errors (exhaustiveness check passes everywhere)
- [x] Run `yarn test` — full test suite passes
- [x] Run `yarn lint` — all issues fixed
- [x] Verify: new `task` descriptor variant exists in union type
- [x] Verify: cron/heartbeat/webhook default to `{ type: "task", id }` instead of system descriptors

### Task 7: [Final] Update documentation
- [x] Update relevant plugin/module README if descriptor types are documented
- [x] Add doc entry in `/doc/` describing the task descriptor type

## Technical Details

### New descriptor shape
```typescript
{ type: "task"; id: string }
```

### Cache key format
```
/task/{taskId}
```

### Role mapping
```
task → "task" (new ModelRoleKey)
```

### Agent resolution behavior
Same as cron: if `descriptor.id` is a valid cuid2, reuse that ID as the agent ID for persistence. This ensures the same task always resolves to the same agent.

### Trigger default change
```
// Before (each trigger type)
const target = task.agentId
    ? { agentId: task.agentId }
    : { descriptor: { type: "system", tag: "cron" } };

// After
const target = task.agentId
    ? { agentId: task.agentId }
    : { descriptor: { type: "task", id: task.taskId } };
```

### Heartbeat batch consideration
Heartbeats currently batch all tasks per user into a single post to `system:heartbeat`. With task descriptors, each task should post to its own `{ type: "task", id: taskId }` agent. This means the batch loop needs to post per-task rather than per-user, or continue batching but use the first task's ID (less ideal). The per-task approach is cleaner and consistent with the design goal.

## Post-Completion

**Manual verification:**
- Start a local env (`yarn env <name>`) and create a cron task without explicit `agentId`
- Verify the agent created uses `task` descriptor type instead of `system:cron`
- Verify the same agent is reused across cron invocations of the same task
- Test heartbeat task isolation — two heartbeat tasks should create two separate agents
