# Memory Search Subagent

## Overview
Add a new agent descriptor type `memory-search` that operates like a subagent (has `id`, `parentAgentId`, `name`) but with a specialized system prompt for navigating the memory graph and answering questions. A dedicated `search_memory` tool spawns these agents with a query and returns results asynchronously.

Key properties:
- Same lifecycle as subagents (id, parentAgentId, name)
- Read-only access to memory graph (only `memory_node_read`)
- Excluded from memory extraction (like `memory-agent`)
- Dedicated `search_memory` tool for spawning
- Custom `MEMORY_SEARCH.md` system prompt

## Context
- Descriptor types defined in `sources/engine/agents/ops/agentDescriptorTypes.ts`
- Cache keys in `agentDescriptorCacheKey.ts`
- Labels in `agentDescriptorLabel.ts`
- Tool allowlist in `agentToolExecutionAllowlistResolve.ts`
- Agent prompt resolution in `agentPromptResolve.ts`
- Background tools in `sources/engine/modules/tools/background.ts`
- Preamble section in `agentSystemPromptSectionPreamble.ts`
- Memory worker recursion guard in `memoryWorker.ts` and `agent.ts`
- Background listing in `agentBackgroundList.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `memory-search` descriptor type
- [x] Add `memory-search` variant to `AgentDescriptor` union in `agentDescriptorTypes.ts` with fields: `type`, `id`, `parentAgentId`, `name`
- [x] Add cache key case in `agentDescriptorCacheKey.ts`: `/memory-search/${descriptor.id}`
- [x] Add label case in `agentDescriptorLabel.ts`: return `descriptor.name`
- [x] Write test for cache key in `agentDescriptorCacheKey.spec.ts`
- [x] Run tests — must pass before next task

### Task 2: Wire `memory-search` into agent system prompt and prompt resolution
- [x] Add `memory-search` case in `agentPromptResolve.ts` — load `memory/MEMORY_SEARCH.md` with `replaceSystemPrompt: true`
- [x] Update `agentSystemPromptSectionPreamble.ts` to pass `parentAgentId` for `memory-search` type (alongside `subagent` and `app`)
- [x] Write test for prompt resolution in `agentPromptResolve.spec.ts`
- [x] Run tests — must pass before next task

### Task 3: Add tool allowlist and memory extraction exclusion
- [x] Update `agentToolExecutionAllowlistResolve.ts` to handle `memory-search` — allow only `memory_node_read` (plus RLM/skip if enabled)
- [x] Update `invalidateSessionIfNeeded` in `agent.ts` to skip `memory-search` (like `memory-agent`)
- [x] Update `memoryWorker.ts` to skip `memory-search` sessions (like `memory-agent`)
- [x] Write test for allowlist in `agentToolExecutionAllowlistResolve.spec.ts`
- [x] Run tests — must pass before next task

### Task 4: Update background agent listing and parent resolution
- [x] Update `agentBackgroundList.ts` to handle `memory-search` — extract `name` and `parentAgentId`
- [x] Update `send_agent_message` in `background.ts` to resolve `parentAgentId` for `memory-search` type
- [x] Update `sendUserMessageTool.ts` to resolve `parentAgentId` for `memory-search` type
- [x] Update `channelSendTool.ts` to resolve sender username for `memory-search` type
- [x] Run tests — must pass before next task

### Task 5: Create `MEMORY_SEARCH.md` system prompt
- [x] Create `sources/prompts/memory/MEMORY_SEARCH.md` with prompt for graph navigation and query answering
- [x] Prompt instructs agent to: read root, navigate graph, find relevant nodes, synthesize answer, respond via `<response>` tag
- [x] Run tests — must pass before next task

### Task 6: Build `search_memory` tool
- [x] Create `sources/engine/modules/tools/memorySearchToolBuild.ts` with `search_memory` tool
- [x] Tool schema: `query` (required string) — the question to answer from memory
- [x] Tool creates `memory-search` descriptor with `createId()`, parent from `toolContext.agent.id`, name from query
- [x] Tool posts query as message to the new agent, returns agent ID asynchronously
- [x] Register tool in engine.ts (same location as `start_background_agent`)
- [x] Run tests — must pass before next task

### ➕ Task 6b: Wire memory-search into agent loop and agent system
- [x] Update `agentLoopRun.ts` — add `memory-search` to `isChildAgent` check and `subagentDeliverResponse`
- [x] Update `agentSystemPromptSectionAutonomousOperation.ts` — add `memory-search` to `parentAgentId` resolution
- [x] Update `agentSystem.ts` — exclude from memory extraction on idle, add to poison-pill scheduling
- [x] Update `memoryNodeReadToolBuild.ts` — make `memory_node_read` visible by default for `memory-search`

### Task 7: Verify acceptance criteria
- [x] Verify descriptor type compiles and is exhaustive (no `never` errors)
- [x] Verify memory-search agents get read-only tools
- [x] Verify memory-search sessions are excluded from memory extraction
- [x] Run full test suite (`yarn test`) — 279 files, 1086 tests passed
- [x] Run linter (`yarn lint`) — clean
- [x] Run typecheck (`yarn typecheck`) — clean

### Task 8: Update documentation
- [x] Document the new descriptor type in `doc/internals/agent-types.md`
- [x] Add mermaid diagram showing memory-search agent flow
- [x] Add memory-search section with sequence diagram

## Technical Details

### Descriptor Shape
```typescript
{
    type: "memory-search";
    id: string;
    parentAgentId: string;
    name: string;  // query title
}
```

### Tool Schema
```typescript
{
    name: "search_memory",
    description: "Search the memory graph to answer a question. Returns asynchronously.",
    parameters: {
        query: Type.String({ minLength: 1 })
    }
}
```

### System Prompt (MEMORY_SEARCH.md)
Core role: navigate the memory graph tree, read relevant nodes, synthesize an answer to the query. Read-only — never modify the graph. Respond with findings via `<response>` tag to parent.

### Tool Allowlist
- `memory_node_read` (always)
- `rlm` / `skip` (if RLM enabled)

## Post-Completion

**Manual verification:**
- Spawn a memory-search agent from a foreground agent and verify it navigates the graph
- Verify the agent returns a response to the parent
- Verify no memory extraction is triggered for memory-search sessions
