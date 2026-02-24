# Remove Response Tag, Use send_agent_message Only

## Overview

Models get confused between `<response>` tags and `send_agent_message` tool calls — they often do both, duplicating messages to the parent agent. This change removes `<response>` tag extraction entirely and makes `send_agent_message` the sole mechanism for child-to-parent communication.

The system will track whether `send_agent_message` was called targeting the parent. If the child agent finishes without sending, it gets one soft nudge. If the agent still doesn't send after the nudge, that's accepted (the agent chose not to respond).

## Context

- **Inference loop**: `packages/daycare/sources/engine/agents/ops/agentLoopRun.ts` — `<response>` extraction (lines 461-469), nudge logic (lines 569-594), `subagentDeliverResponse` (lines 926-953)
- **Prompts**: `packages/daycare/sources/prompts/SYSTEM.md` (line 4), `SYSTEM_AGENCY.md` (line 6) — `<response>` tag instructions
- **Tools**: `packages/daycare/sources/engine/modules/tools/background.ts` — `send_agent_message` tool
- **Callers**: `skillToolBuild.ts` (line 115) and `appExecute.ts` (line 76) use `postAndAwait` and read `responseText`

## Development Approach

- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Implementation Steps

### Task 1: Track `send_agent_message` calls in inference loop

Replace the `<response>` tag extraction with tracking of `send_agent_message` tool calls targeting the parent agent.

- [x] In `agentLoopRun.ts`, remove state variables `childAgentResponded` and `childAgentNudged`
- [x] Add new state variable `childAgentMessageSent: boolean`
- [x] Remove the `<response>` tag extraction block
- [x] In the tool execution loop, track `send_agent_message` calls targeting the parent
- [x] Replace the nudge block with soft nudge logic (nudge once, accept if skipped)
- [x] Remove `subagentDeliverResponse` function entirely
- [x] Remove unused `tagExtract` import (kept `tagExtractAll` for `<say>` blocks)
- [x] Write 6 tests covering all tracking and nudge scenarios
- [x] Run tests — all pass

### Task 2: Update system prompts

Remove `<response>` tag instructions and tell agents to use `send_agent_message`.

- [x] Update `SYSTEM.md` — replaced `<response>` tag instructions with `send_agent_message` usage
- [x] Update `SYSTEM_AGENCY.md` — replaced `<response>` reference with `send_agent_message`
- [x] Update `MEMORY_SEARCH.md` — replaced `<response>` tag format with `send_agent_message`
- [x] Run tests — all pass

### Task 3: Verify acceptance criteria

- [x] Verify `send_agent_message` tracking works for sandbox skill subagents (`postAndAwait` path)
- [x] Verify tracking works for fire-and-forget subagents (`start_background_agent`)
- [x] Verify nudge triggers when agent finishes without calling `send_agent_message`
- [x] Verify agent can skip sending after nudge (no error, loop just ends)
- [x] Verify non-child agent behavior is unchanged
- [x] Verify `send_agent_message` still works for ad-hoc messaging to other agents
- [x] Run full test suite — 1365 tests pass
- [x] Run typecheck — clean
- [x] Run linter — clean

### Task 4: Update documentation

- [x] Update `doc/internals/agents.md` — rewrote "Background agent reporting" section
- [x] Update `doc/internals/agent-types.md` — updated mermaid diagrams to show `send_agent_message`

## Technical Details

### Tool call tracking in the inference loop

After each tool call execution (around line 633 in `agentLoopRun.ts`), inspect the tool call:

```typescript
if (isChildAgent && toolCall.name === "send_agent_message") {
    const args = toolCall.arguments as { agentId?: string; text?: string };
    const parentId = (agent.descriptor as { parentAgentId?: string }).parentAgentId;
    if (!args.agentId || args.agentId === parentId) {
        childAgentMessageSent = true;
        if (args.text) {
            finalResponseText = args.text;
        }
    }
}
```

### Nudge message (new wording)

```
You haven't sent your results to your parent agent yet. Use the send_agent_message tool to deliver your results. No agentId is needed — it defaults to your parent.
```

### `finalResponseText` behavior

`finalResponseText` is captured from the `send_agent_message` tool call arguments. This ensures:
- `postAndAwait` callers (`skillToolBuild.ts`, `appExecute.ts`) still get `responseText` in the result
- The message is delivered via `agentSystem.post()` during tool execution (existing `send_agent_message` behavior)
- No duplicate delivery — removing `subagentDeliverResponse` means only the tool's own delivery happens

### What stays unchanged

- `tagExtractAll` (used for `<say>` blocks) — unrelated, stays
- `send_agent_message` tool implementation in `background.ts` — unchanged
- `send_user_message` tool — unrelated, stays
- Foreground agent behavior — unaffected

## Post-Completion

**Manual verification:**
- Test with a live subagent to confirm `send_agent_message` is used as the sole reporting mechanism
- Test that sandbox skills still return results correctly via `postAndAwait`
- Test that background agents deliver results to parent via `send_agent_message`
- Verify nudge fires when model forgets to call `send_agent_message`
- Verify model can choose to skip after nudge without error
