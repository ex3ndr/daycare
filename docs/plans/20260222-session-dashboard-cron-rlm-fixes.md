# Session Lifecycle, Dashboard Sessions, Cron & RLM Fixes

## Overview
Five improvements to session tracking, dashboard visibility, cron UX, and RLM tool filtering:

1. **Mark sessions as ended** — add `endedAt` timestamp so consumers can distinguish active vs finished sessions
2. **Dashboard session view** — show per-session history in the agent detail page
3. **Memory-search in dashboard** — add missing `memory-search` agent type to the dashboard
4. **One-shot cron descriptions** — improve `cron_add` tool description so the LLM knows about `deleteAfterRun`
5. **RLM tool filtering for restricted agents** — memory-search (and memory-agent) see all tools in the RLM system prompt instead of only their allowed tools

## Context

### Sessions
- `SessionDbRecord` has `id`, `agentId`, `createdAt`, `resetMessage`, `invalidatedAt`, `processedUntil` — no `endedAt`
- `SessionsRepository` creates sessions but never marks old ones as ended
- `HistoryRepository` already has `findBySessionId()` — not exposed via IPC
- `SessionsRepository.findByAgentId()` returns sessions ordered by `created_at ASC`

### Dashboard
- `agent-types.ts` defines `AgentType` union — missing `memory-search` type
- `buildAgentType()` has no `memory-search` case → falls to `{ type: "system", tag: "unknown" }`
- Agent detail page (`agentDetailClient.tsx`) queries history per agent, not per session
- `fetchAgentHistory()` calls `GET /v1/engine/agents/:agentId/history`

### One-shot crons
- `deleteAfterRun` already exists in schema, DB, scheduler, and `cron_add` tool
- The `cron_add` tool description says only: "Create a scheduled cron task from a prompt stored in SQLite (optional agentId)."
- No mention of `deleteAfterRun` — the LLM doesn't know it can create one-shot tasks

### RLM tool filtering bug
- `toolVisibleByDefault()` returns `true` when a tool has no `visibleByDefault` callback
- Most tools (cron_add, send_user_message, etc.) lack this callback → visible to all agents
- `agentToolExecutionAllowlistResolve()` restricts memory-search to `["memory_node_read"]` but only at execution time
- In RLM no-tools mode, `agentSystemPromptSectionToolCalling` builds Python stubs for ALL visible tools
- Result: memory-search system prompt contains stubs for ~30 tools instead of just `memory_node_read`
- Same issue affects `memory-agent` (should only see `memory_node_read` + `memory_node_write`)

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `endedAt` to sessions

- [ ] Create migration `20260222_session_ended_at.ts` adding `ended_at INTEGER` column to `sessions` table
- [ ] Register migration in the migrations list
- [ ] Add `endedAt` to `DatabaseSessionRow` and `SessionDbRecord` types in `databaseTypes.ts`
- [ ] Update `SessionsRepository.sessionParse()` to include `endedAt`
- [ ] Add `SessionsRepository.endSession(sessionId: string, endedAt: number)` method
- [ ] Call `endSession()` on the current active session when creating a new session in `Storage.createAgent()` / wherever new sessions are created on reset
- [ ] Write tests for `endSession()` in `sessionsRepository.spec.ts`
- [ ] Write test: creating a new session marks the previous one as ended
- [ ] Run tests — must pass before next task

### Task 2: Expose sessions in IPC and dashboard

- [ ] Add `GET /v1/engine/agents/:agentId/sessions` endpoint to `server.ts` returning sessions list
- [ ] Add `GET /v1/engine/agents/:agentId/history?sessionId=X` query param support to filter history by session
- [ ] Add `fetchAgentSessions()` function in dashboard `engine-client.ts`
- [ ] Update `fetchAgentHistory()` to accept optional `sessionId` parameter
- [ ] Add session selector UI in `agentDetailClient.tsx` — dropdown/tabs showing session numbers (computed from creation order)
- [ ] Show session metadata (createdAt, endedAt, resetMessage) in the selector
- [ ] Default to latest (active) session
- [ ] Write test for the new IPC sessions endpoint
- [ ] Write test for history filtering by sessionId
- [ ] Run tests — must pass before next task

### Task 3: Add `memory-search` to dashboard agent types

- [ ] Add `{ type: "memory-search"; id: string; parentAgentId: string; name: string }` to `AgentType` union in `agent-types.ts`
- [ ] Add `case "memory-search"` in `buildAgentType()` returning the new type
- [ ] Add `case "memory-search"` in `formatAgentTypeLabel()` returning `"Memory Search"`
- [ ] Run tests — must pass before next task

### Task 4: Improve `cron_add` tool description for one-shot support

- [ ] Update `cron_add` tool description in `cron.ts` to mention `deleteAfterRun` for one-shot tasks
- [ ] Add parameter descriptions to the TypeBox schema (use `description` field on `deleteAfterRun` and `schedule`)
- [ ] Run tests — must pass before next task

### Task 5: Filter RLM tool list by execution allowlist

- [ ] In `agentSystemPromptSectionToolCalling.ts`, after resolving visible tools, apply the execution allowlist filter
- [ ] Import `agentToolExecutionAllowlistResolve` and use it to filter `availableTools` when descriptor is present
- [ ] When allowlist is defined, filter `availableTools` to only include tools in the allowlist (excluding `run_python`/`skip` which are RLM-internal)
- [ ] Write test: memory-search agent's tool section only contains `memory_node_read` stubs
- [ ] Write test: memory-agent's tool section only contains `memory_node_read` + `memory_node_write` stubs
- [ ] Write test: regular agents still see all tools (no allowlist → no filtering)
- [ ] Run tests — must pass before next task

### Task 6: Verify acceptance criteria

- [ ] Verify sessions have `endedAt` set correctly on reset
- [ ] Verify dashboard shows session list with per-session history
- [ ] Verify memory-search agents display correctly in dashboard
- [ ] Verify `cron_add` tool description mentions one-shot capability
- [ ] Verify memory-search RLM prompt contains only `memory_node_read`
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`)
- [ ] Run typecheck (`yarn typecheck`)

### Task 7: [Final] Update documentation

- [ ] Update relevant docs in `/doc/` if new patterns discovered
- [ ] Add mermaid diagram for session lifecycle if helpful

## Technical Details

### Session lifecycle (Task 1)

```
Agent created → Session A created (endedAt: null, active)
Agent reset   → Session A.endedAt = now, Session B created (active)
Agent reset   → Session B.endedAt = now, Session C created (active)
```

Session numbers are computed from creation order (1-indexed):
```
Session 1 (ended) → Session 2 (ended) → Session 3 (active)
```

### RLM tool filtering (Task 5)

```
Before fix:
  toolListVisibleResolve() → 30+ tools (most have no visibleByDefault)
  → rlmNoToolsPromptBuild(30+ tools) → Python stubs for everything

After fix:
  toolListVisibleResolve() → 30+ tools
  → filter by allowlist for memory-search → [memory_node_read]
  → rlmNoToolsPromptBuild([memory_node_read]) → 1 Python stub
```

### Dashboard session selector (Task 2)

```
┌─────────────────────────────────┐
│ Agent: user/telegram/123        │
│ ┌─────────────────────────────┐ │
│ │ Session: ▼ #3 (active)     │ │
│ │   #1 (ended 2h ago)        │ │
│ │   #2 (ended 30m ago)       │ │
│ │ ► #3 (active)              │ │
│ └─────────────────────────────┘ │
│                                 │
│ [history records for session 3] │
└─────────────────────────────────┘
```

## Post-Completion

**Manual verification:**
- Test session lifecycle by triggering agent resets via dashboard
- Verify dashboard session selector works with agents that have multiple sessions
- Confirm one-shot cron scheduling works end-to-end via LLM
- Check RLM system prompt snapshot for memory-search agent to verify only `memory_node_read` stubs present
