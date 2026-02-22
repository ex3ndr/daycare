# Memory Agent Descriptor

## Overview
Instead of running inference directly inside the memory worker, route session memory to a dedicated **memory-agent** (one per source agent). This agent receives formatted transcripts as messages and summarizes them via normal agent inference. Memory-agents use a new descriptor type `memory-agent` and their sessions are never invalidated (preventing recursive memory processing).

## Context
- **Memory worker**: `sources/engine/memory/memoryWorker.ts` — polls invalidated sessions on a 30s tick
- **Session observation**: `sources/engine/memory/memorySessionObserve.ts` — extracts observations via direct inference
- **Agent descriptors**: `sources/engine/agents/ops/agentDescriptorTypes.ts` — discriminated union of agent types
- **Descriptor cache key**: `sources/engine/agents/ops/agentDescriptorCacheKey.ts` — stable key per descriptor
- **Agent system**: `sources/engine/agents/agentSystem.ts` — agent lifecycle, inbox posting, sleep/wake
- **Agent invalidation points**: `agent.ts:invalidateSessionIfNeeded`, `agent.ts:handleReset`, `agent.ts:applyCompactionSummary`, `agentSystem.ts:sleepIfIdle`
- **Transcript formatting**: `sources/engine/memory/infer/utils/formatHistoryMessages.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Implementation Steps

### Task 1: Add `memory-agent` descriptor type
- [ ] Add `{ type: "memory-agent"; id: string }` variant to `AgentDescriptor` union in `agentDescriptorTypes.ts` — `id` references the source agent being summarized
- [ ] Add cache key case `case "memory-agent": return \`/memory-agent/${descriptor.id}\`` in `agentDescriptorCacheKey.ts`
- [ ] Verify exhaustive switch in `descriptorTypeUnreachable` still compiles (adding the case makes it complete)
- [ ] Handle `memory-agent` in `agentDescriptorMatchesStrategy.ts` — return `false` for all strategies
- [ ] Handle `memory-agent` in `agentDescriptorTargetResolve.ts` — return `null` (no connector target)
- [ ] Handle `memory-agent` in `resolveUserIdForDescriptor` in `agentSystem.ts` — use `ownerUserIdEnsure()` (same as cron/system)
- [ ] Handle `memory-agent` in `agentPromptResolve.ts` — no custom prompt override (return null/empty)
- [ ] Write test for `agentDescriptorCacheKey` with `memory-agent` descriptor
- [ ] Run tests — must pass before next task

### Task 2: Skip session invalidation for memory-agents
- [ ] In `agent.ts:invalidateSessionIfNeeded()`, check `this.descriptor.type === "memory-agent"` and return early
- [ ] In `agent.ts:handleReset()`, skip the invalidation block when `this.descriptor.type === "memory-agent"`
- [ ] In `agent.ts:applyCompactionSummary()`, skip the invalidation block when `this.descriptor.type === "memory-agent"`
- [ ] In `agentSystem.ts:sleepIfIdle()`, skip session invalidation when `entry.descriptor.type === "memory-agent"`
- [ ] Run tests — must pass before next task

### Task 3: Create memory-agent system prompt
- [ ] Create `sources/prompts/memory/MEMORY_AGENT.md` with instructions for the memory-agent role: receive session transcripts, extract and summarize key observations, output structured observations
- [ ] Wire it into `agentSystemPrompt.ts` or `agentPromptResolve.ts` so `memory-agent` descriptors get this prompt as their system prompt section
- [ ] Run tests — must pass before next task

### Task 4: Route memory worker sessions to memory-agent
- [ ] In `memoryWorker.ts`, add access to `AgentSystem` (pass as option or via a posting function)
- [ ] In the `tick()` loop, after loading the agent record, look up or lazy-create a memory-agent for the source agent using descriptor `{ type: "memory-agent", id: session.agentId }`
- [ ] Format the session records into a transcript using `formatHistoryMessages()`
- [ ] Post the transcript as a `system_message` to the memory-agent via `agentSystem.post()`
- [ ] Remove the direct `memorySessionObserve()` inference call from the tick loop
- [ ] Keep `markProcessed()` call — sessions are still marked processed after posting
- [ ] Write test for memory worker skipping `memory-agent` type agents (verify no recursion)
- [ ] Run tests — must pass before next task

### Task 5: Verify acceptance criteria
- [ ] Verify memory-agent descriptor is properly created, cached, and resolved
- [ ] Verify memory-agent sessions are never invalidated
- [ ] Verify memory worker posts transcripts to memory-agent instead of running inference directly
- [ ] Verify memory-agents don't trigger the memory worker (no recursion)
- [ ] Run full test suite (unit tests)
- [ ] Run linter — all issues must be fixed
- [ ] Run typecheck — must pass

### Task 6: [Final] Update documentation
- [ ] Update `/doc/` with changes to memory architecture
- [ ] Document the new `memory-agent` descriptor type

## Technical Details

### Descriptor Shape
```typescript
{ type: "memory-agent"; id: string }
// id = source agentId this memory-agent processes for
```

### Cache Key
```
/memory-agent/<sourceAgentId>
```

### Memory Worker Flow (after)
```
tick()
  → sessions.findInvalidated(10)
  → for each session:
    → skip if agent descriptor is "memory-agent"
    → formatHistoryMessages(records) → transcript
    → agentSystem.post({ descriptor: { type: "memory-agent", id: agentId } }, { type: "system_message", text: transcript })
    → sessions.markProcessed()
```

### Invalidation Skip Points
```
agent.ts:invalidateSessionIfNeeded  → skip if descriptor.type === "memory-agent"
agent.ts:handleReset                → skip invalidation block
agent.ts:applyCompactionSummary     → skip invalidation block
agentSystem.ts:sleepIfIdle          → skip session invalidation block
```

## Post-Completion
- Verify memory-agent sessions accumulate context without being reset by memory worker
- Monitor memory-agent context growth over time (may need compaction strategy later)
