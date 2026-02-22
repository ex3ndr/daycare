# Memory Search Prompt Reframe

## Overview
- Reframe `search_memory` from "spawns a background agent" to a function that returns a query ID for follow-up
- Add system prompt guidance teaching the main agent when and how to query memory
- The memory-search agent's own prompt (MEMORY_SEARCH.md) stays unchanged — only callers get reframed

## Context (from discovery)
- Tool definition: `packages/daycare/sources/engine/modules/tools/memorySearchToolBuild.ts`
- System memory prompt: `packages/daycare/sources/prompts/SYSTEM_MEMORY.md`
- Tool currently says "Spawns a background agent that navigates the memory graph"
- SYSTEM_MEMORY.md currently only covers workspace memory files (SOUL.md, USER.md, etc.)
- No existing guidance tells the main agent when to use `search_memory`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- These are prompt/description-only changes — no logic changes
- MEMORY_SEARCH.md is NOT changed (only caller-facing text)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with + prefix
- Document issues/blockers with ! prefix

## Implementation Steps

### Task 1: Reframe search_memory tool description
- [x] Update `memorySearchToolBuild.ts` tool description to function/query language (remove "spawns a background agent" wording, describe as a function that searches memory and returns a query ID)
- [x] Update the JSDoc comment on `memorySearchToolBuild` function
- [x] Update the summary message text (currently "Memory search started: {agentId}")
- [x] Run `yarn typecheck` — must pass before next task

### Task 2: Add memory search guidance to SYSTEM_MEMORY.md
- [x] Add a "Memory Search" section to `SYSTEM_MEMORY.md` with guidance on:
  - `search_memory` is a function that queries the memory graph and returns a query ID
  - Query results arrive asynchronously — use the query ID to reference results
  - Query memory in parallel with other tool calls (RLM: call search_memory alongside other tools)
  - Always query memory before starting background jobs (learn about tools, context, preferences first)
  - Query memory about tools and how they work before using unfamiliar tools
- [x] Ensure the section is conditional on memory being available (Handlebars guard if needed)
- [x] Run `yarn typecheck` — must pass before next task

### Task 3: Verify acceptance criteria
- [x] Verify tool description no longer uses "agent" or "subagent" language
- [x] Verify SYSTEM_MEMORY.md includes all three guidance points (parallel, before background jobs, tool knowledge)
- [x] Verify MEMORY_SEARCH.md is unchanged
- [x] Run `yarn typecheck`
- [x] Run `yarn lint`
- [x] Run `yarn test`

## Technical Details
- `search_memory` tool returns `{ summary, targetAgentId, originAgentId }` — the `targetAgentId` serves as the query ID
- Results are delivered asynchronously via `system_message` to the parent agent
- In RLM mode, the tool appears as a Python function stub — its description auto-generates from the tool definition
- SYSTEM_MEMORY.md uses Handlebars templating with variables like `soulPath`, `userPath`, etc.

## Post-Completion

**Manual verification:**
- Test that a foreground agent sees the updated tool description
- Verify the RLM preamble reflects the new description
- Confirm the memory search guidance appears in the assembled system prompt
