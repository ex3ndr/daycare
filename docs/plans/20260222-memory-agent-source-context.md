# Memory Agent Source Context

## Overview
Pass source agent context (foreground vs background) through both memory pipelines so the model understands whether it's processing a user conversation or an automated agent's task execution. Currently both `OBSERVE.md` and `MEMORY_AGENT.md` hard-code the assumption that transcripts come from human-AI conversations, which produces misleading extraction for background agent sessions (cron, system, subagent, app, permanent).

**Approach**: No descriptor changes. The `MemoryWorker` prepends a text preamble to the transcript itself. The `OBSERVE.md` pipeline gets `isForeground` as a function parameter and uses Handlebars conditionals.

## Context (from discovery)
- **MemoryWorker** (`memoryWorker.ts:108-135`): has the source agent's descriptor but discards the type info
- **inferObservations** (`inferObservations.ts`): receives no agent type info at all
- **OBSERVE.md**: opens with "Extract observations from a conversation between a person and an AI assistant" — wrong for background agents
- **MEMORY_AGENT.md**: no source context — assumes user conversation
- **formatHistoryMessages** (`formatHistoryMessages.ts`): labels all entries as "User"/"Assistant" regardless of source agent type
- Agent foreground detection: `descriptor.type === "user"` (used in preamble, agency, memory prompt sections)

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

### Task 1: Add `isForeground` parameter to formatHistoryMessages
- [x] Add `isForeground: boolean` parameter to `formatHistoryMessages` (`formatHistoryMessages.ts`)
- [x] When `isForeground=false`: use `## System Message` instead of `## User`, `## Agent` instead of `## Assistant`
- [x] Update all call sites of `formatHistoryMessages` to pass `isForeground` (default `true` for existing callers)
- [x] Write tests for `formatHistoryMessages` with both foreground and background labels
- [x] Run tests — must pass before next task

### Task 2: Prepend source context preamble in MemoryWorker transcript
- [x] In `MemoryWorker.tick()`, resolve `isForeground` from the source agent's descriptor (`agent.descriptor.type === "user"`)
- [x] Pass `isForeground` to `formatHistoryMessages` when building transcript
- [x] When `isForeground=false`, prepend a context line to the transcript
- [x] Write test for MemoryWorker transcript generation with foreground/background source agents
- [x] Run tests — must pass before next task

### Task 3: Thread `isForeground` into observation pipeline (OBSERVE.md)
- [x] Add `isForeground` parameter to `inferObservations` function signature
- [x] Compile `OBSERVE.md` with Handlebars, passing `isForeground` — swap the opening line for background agents
- [x] Update `OBSERVE.md` with `{{#if isForeground}}` conditional on the opening description
- [x] Update `memorySessionObserve` to accept and pass `isForeground` to `inferObservations`
- [x] Pass `isForeground` to `formatHistoryMessages` inside `inferObservations`
- [x] Write test for `memorySessionObserve` with foreground/background context
- [x] Run tests — must pass before next task

### Task 4: Verify acceptance criteria
- [x] Verify: memory-agent for a `user` descriptor source gets foreground transcript (User/Assistant labels, no preamble)
- [x] Verify: memory-agent for a background agent source gets background transcript (System Message/Agent labels, preamble prepended)
- [x] Verify: observation pipeline gets correct `isForeground` flag and OBSERVE.md renders conditionally
- [x] Run full test suite (1082 tests pass)
- [x] Run linter — no issues
- [x] Run typecheck — passes

### Task 5: [Final] Update documentation
- [x] No memory plugin README or `/doc/` memory docs exist — nothing to update

## Technical Details

### Data flow — Memory-agent pipeline
```
MemoryWorker.tick()
  → storage.agents.findById(session.agentId)    // get source agent
  → isForeground = agent.descriptor.type === "user"
  → transcript = formatHistoryMessages(records, isForeground)   // labels change
  → if (!isForeground) transcript = preamble + transcript       // prepend context
  → postToAgent({ descriptor }, { type: "system_message", text: transcript })
```

### Data flow — Observation pipeline
```
memorySessionObserve({ ..., isForeground })
  → inferObservations({ records, ..., isForeground })
      → formatHistoryMessages(records, isForeground)   // labels change
      → compile OBSERVE.md with { isForeground }        // Handlebars conditional
```

### Prompt changes

**OBSERVE.md** — swap opening via Handlebars:
```handlebars
{{#if isForeground}}
Extract observations from a conversation between a person and an AI assistant. Each observation is a discrete fact worth remembering across sessions.
{{else}}
Extract observations from an automated agent's task execution log. There is no human participant. Each observation is a discrete fact about what was done, what succeeded/failed, and what was learned. Focus on systems, processes, and outcomes rather than personal preferences.
{{/if}}
```

**MEMORY_AGENT.md** — no Handlebars changes needed. The transcript text itself carries the source context as a prepended blockquote. The prompt stays generic.

**MemoryWorker transcript preamble** (prepended when `isForeground=false`):
```
> Source: This transcript is from an automated agent performing background work. There is no human participant. Extract facts about what was done, what succeeded/failed, and what was learned about systems and processes.
```

**formatHistoryMessages** labels:
| isForeground | user_message label | assistant_message label |
|---|---|---|
| true | `## User` | `## Assistant` |
| false | `## System Message` | `## Agent` |

## Post-Completion
- Manually verify with a real background agent (cron/heartbeat) that memory extraction uses the correct framing
- Check that existing foreground agent memory extraction is unchanged
