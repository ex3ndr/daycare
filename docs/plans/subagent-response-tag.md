# Subagent Response Tag

## Overview

Replace the `send_agent_message`-based reporting mechanism for subagents with a `<response>...</response>` tag emitted in the model's text output. The harness (`agentLoopRun`) extracts the tag content, strips it from visible text, and auto-delivers it to the parent agent. If the model forgets the tag, the harness nudges it once; if still missing after the nudge, it generates a synthetic error response.

This applies to **all subagents** (type === `"subagent"`), both fire-and-forget (`start_background_agent`) and synchronous (`postAndAwait` sandbox skills). `send_agent_message` remains available for ad-hoc messaging but is no longer the primary "report back" mechanism.

## Context

- **Harness**: `packages/daycare/sources/engine/agents/ops/agentLoopRun.ts` — inference loop, returns `{ responseText, ... }`
- **Agent handler**: `packages/daycare/sources/engine/agents/agent.ts` — `handleMessage()` calls `agentLoopRun`, returns `responseText`
- **Prompts**: `packages/daycare/sources/prompts/SYSTEM.md`, `AGENTIC.md` — instructions to subagents
- **Tools**: `packages/daycare/sources/engine/modules/tools/background.ts` — `send_agent_message` tool
- **Existing patterns**: `messageNoMessageIs.ts` (sentinel detection), `messageBuildSystemText.ts` (tag building), `xmlEscape.ts` (escaping)

## Development Approach

- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Create generic `tagExtract` utility

Create `packages/daycare/sources/util/tagExtract.ts` — a generic, reusable function that extracts content between XML-like tags from text.

- [ ] Create `tagExtract(text: string, tag: string): string | null`
  - Case-insensitive tag matching (handles `<Response>`, `<RESPONSE>`, `<response>`)
  - Finds the **first** occurrence of `<tag>` (with optional attributes) and the **last** occurrence of `</tag>`
  - Returns the unmodified content between them, trimmed only
  - Returns `null` if either tag is missing
  - No escaping needed — raw content passthrough
- [ ] Create `tagStrip(text: string, tag: string): string`
  - Removes the matched `<tag>...</tag>` block (same first-open/last-close logic) from the text
  - Returns the remaining text
  - If no tag found, returns text unchanged
- [ ] Write tests in `tagExtract.spec.ts`:
  - Basic extraction: `<response>hello</response>` → `"hello"`
  - Case insensitive: `<Response>`, `<RESPONSE>`, `<rEsPoNsE>`
  - Nested content: `<response>has <inner> tags</response>` → `"has <inner> tags"`
  - Multiple occurrences: first open + last close wins
  - With attributes: `<response foo="bar">content</response>` → `"content"`
  - Missing open tag → `null`
  - Missing close tag → `null`
  - Empty content → `""` (empty string, not null)
  - Multiline content preserved
  - Content trimmed (leading/trailing whitespace only)
  - `tagStrip` removes the block and returns remaining text
  - `tagStrip` with no match returns text unchanged
- [ ] Run tests — must pass before next task

### Task 2: Add response extraction + nudge logic in `agentLoopRun`

Modify `packages/daycare/sources/engine/agents/ops/agentLoopRun.ts` to extract `<response>` tags for subagents and nudge if missing.

- [ ] Add `isSubagent` to `AgentLoopRunOptions` (derived from `agent.descriptor.type === "subagent"` at call site in `agent.ts`)
- [ ] After the `toolCalls.length === 0` check (line ~270), add subagent response logic:
  - If `isSubagent` is true:
    - Use `tagExtract(responseText, "response")` to check for `<response>` tag
    - If found: set `finalResponseText` to the extracted content, strip the tag block from the model message text (use `tagStrip`)
    - If NOT found and not yet nudged: push a system message to `context.messages` saying something like `"You must wrap your final answer in <response>...</response> tags. Emit your response now."`, set a `nudged` flag, `continue` the loop
    - If NOT found and already nudged: break out of the loop, set `finalResponseText` to a synthetic error like `"Error: subagent did not produce a response."`
- [ ] Write tests for the nudge/extraction logic (may need to mock inference):
  - Subagent with `<response>` in first reply → extracted correctly
  - Subagent without `<response>` → nudge message injected
  - Subagent without `<response>` after nudge → error response generated
  - Non-subagent → no change to existing behavior
- [ ] Run tests — must pass before next task

### Task 3: Auto-deliver response to parent agent

Modify `packages/daycare/sources/engine/agents/agent.ts` to auto-send the extracted response to the parent after `agentLoopRun` completes.

- [ ] In `handleMessage`, after `agentLoopRun` returns (around line ~620):
  - If `this.descriptor.type === "subagent"` AND `result.responseText` is non-empty:
    - Send `result.responseText` to `this.descriptor.parentAgentId` via `this.agentSystem.post()` as a `system_message` with `origin: this.id`
    - Use the subagent's name from `this.descriptor.name` in the message
- [ ] Pass `isSubagent: this.descriptor.type === "subagent"` to `agentLoopRun` options
- [ ] Write tests for auto-delivery (success case, no responseText case, non-subagent case)
- [ ] Run tests — must pass before next task

### Task 4: Update system prompts

Update prompt templates to instruct subagents to use `<response>` tags.

- [ ] Modify `packages/daycare/sources/prompts/SYSTEM.md`:
  - Replace the background agent intro (line 4): remove "Use `send_agent_message` to report to parent/foreground agent"
  - Replace with: instruction to wrap final results in `<response>...</response>` tags
  - Explain: first `<response>` and last `</response>` are used, content is sent unmodified (trimmed), no escaping needed
  - Keep `send_agent_message` documented for ad-hoc messaging but not as the primary reporting mechanism
- [ ] Modify `packages/daycare/sources/prompts/AGENTIC.md`:
  - Update worker agent section to mention `<response>` tag for reporting results
- [ ] Verify prompt renders correctly by inspecting template variables
- [ ] Run tests — must pass before next task

### Task 5: Verify acceptance criteria

- [ ] Verify `<response>` extraction works for sandbox skill subagents (`postAndAwait` path)
- [ ] Verify `<response>` extraction + auto-delivery works for fire-and-forget subagents
- [ ] Verify nudge triggers when `<response>` tag is missing
- [ ] Verify error response generated after failed nudge
- [ ] Verify non-subagent behavior is unchanged
- [ ] Verify `send_agent_message` still works for ad-hoc messaging
- [ ] Run full test suite (`yarn test`)
- [ ] Run typecheck (`yarn typecheck`)

### Task 6: Update documentation

- [ ] Update `packages/daycare/sources/prompts/ACTORS.md` if subagent communication wiring changed
- [ ] Add brief note in relevant doc if applicable

## Technical Details

### `tagExtract` behavior

```
Input:  "Some preamble <response>The actual answer</response> trailing"
Output: "The actual answer"

Input:  "<Response>Multi\nline\ncontent</Response>"
Output: "Multi\nline\ncontent"

Input:  "text <response>outer <response>inner</response> middle</response> end"
        ^ first open                                      ^ last close
Output: "outer <response>inner</response> middle"
```

### Nudge message (injected as user message)

```
You must wrap your final answer in <response>...</response> tags. Emit your response now.
```

### Auto-delivery message format

```typescript
agentSystem.post(
  { agentId: parentAgentId },
  {
    type: "system_message",
    text: responseText,  // extracted <response> content
    origin: this.id
  }
);
```

## Post-Completion

**Manual verification:**
- Test with a live subagent to confirm `<response>` tag extraction works end-to-end
- Test that sandbox skills still return results correctly via `postAndAwait`
- Test that background agents auto-deliver to parent inbox
- Verify nudge fires when model forgets the tag (may need a deliberately forgetful prompt)
