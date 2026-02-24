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

- [ ] In `agentLoopRun.ts`, remove state variables `childAgentResponded` and `childAgentNudged`
- [ ] Add new state variable `childAgentMessageSent: boolean` — tracks whether `send_agent_message` was called targeting the parent (or without agentId, which defaults to parent for child agents)
- [ ] Remove the `<response>` tag extraction block (lines 461-469):
  ```typescript
  // Remove this entire block
  if (isChildAgent) {
      const extracted = tagExtract(responseText ?? "", "response");
      ...
  }
  ```
- [ ] In the tool execution loop (after each tool call, around line 633), check if the executed tool was `send_agent_message` and if the target was the parent:
  - Tool name is `"send_agent_message"`
  - No `agentId` in args (defaults to parent) OR `agentId` matches `agent.descriptor.parentAgentId`
  - If matched, set `childAgentMessageSent = true` and capture the `text` argument as `finalResponseText`
- [ ] Replace the nudge block (lines 569-594) with new logic:
  ```
  if (isChildAgent && !childAgentMessageSent) {
      if (!childAgentNudged) {
          childAgentNudged = true;
          // inject user message asking to send results via send_agent_message
          continue;
      } else {
          // agent chose not to send — accept and break
          break;
      }
  }
  ```
  (Keep `childAgentNudged` as a local variable for this nudge-once logic)
- [ ] Remove `subagentDeliverResponse` function entirely (lines 926-953) — delivery now happens via the `send_agent_message` tool execution itself
- [ ] Remove unused `tagExtract` import if no longer needed (check: it's still used for `<say>` blocks via `tagExtractAll`, so keep the import of `tagExtractAll` but remove `tagExtract` if unused)
- [ ] Write tests:
  - Child agent calls `send_agent_message` with no agentId → `childAgentMessageSent` is true, `finalResponseText` captured
  - Child agent calls `send_agent_message` with parent's agentId → same behavior
  - Child agent calls `send_agent_message` with different agentId → `childAgentMessageSent` stays false
  - Child agent finishes without `send_agent_message` → nudge message injected
  - Child agent finishes without `send_agent_message` after nudge → loop breaks (no error)
  - Non-child agent → no tracking, no nudge
- [ ] Run tests — must pass before next task

### Task 2: Update system prompts

Remove `<response>` tag instructions and tell agents to use `send_agent_message`.

- [ ] Update `SYSTEM.md` (line 4, background agent section):
  - Remove: `Wrap results in \`<response>...</response>\` tags — the system extracts everything between...`
  - Replace with: instruction to use `send_agent_message` to deliver results to parent (no agentId needed, defaults to parent)
  - Keep `send_user_message` documentation as-is
- [ ] Update `SYSTEM_AGENCY.md` (line 6, worker agent section):
  - Remove: `via \`<response>...</response>\` tags`
  - Replace with: `via \`send_agent_message\`` (or similar concise instruction)
- [ ] Verify prompt renders correctly by reading the template
- [ ] Run tests — must pass before next task

### Task 3: Verify acceptance criteria

- [ ] Verify `send_agent_message` tracking works for sandbox skill subagents (`postAndAwait` path)
- [ ] Verify tracking works for fire-and-forget subagents (`start_background_agent`)
- [ ] Verify nudge triggers when agent finishes without calling `send_agent_message`
- [ ] Verify agent can skip sending after nudge (no error, loop just ends)
- [ ] Verify non-child agent behavior is unchanged
- [ ] Verify `send_agent_message` still works for ad-hoc messaging to other agents
- [ ] Run full test suite (`yarn test`)
- [ ] Run typecheck (`yarn typecheck`)
- [ ] Run linter (`yarn lint`)

### Task 4: Update documentation

- [ ] Update `doc/internals/agents.md` if it references `<response>` tags
- [ ] Update `doc/internals/agent-types.md` if it references `<response>` tags
- [ ] Archive or update `docs/plans/subagent-response-tag.md` (the plan that introduced the feature we're now removing)

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
