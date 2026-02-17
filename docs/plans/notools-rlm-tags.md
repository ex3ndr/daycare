# noTools: Tag-Based RLM (run_python via `<run_python>` tags)

## Overview

Add a new RLM execution mode (`features.noTools && features.rlm && features.say`) where the model writes Python code inside `<run_python>` tags in its text response instead of calling a `run_python` tool. The model sees **zero tools**. All instructions and available Python function stubs are provided in the system prompt. Execution results are injected as user messages with `<python_result>` tags, and the inference loop continues until no `<run_python>` tags appear.

- Keeps existing `features.rlm` (tool-call-based) fully supported
- Keeps existing `features.say` tag mode compatible (can coexist)
- Uses the existing `tagExtract()` utility (first open tag, last close tag, no escaping)
- Reuses `rlmExecute()` for actual Python execution — only the entry point changes

## Context (from discovery)

**Files involved:**
- `sources/settings.ts` — `FeaturesConfig` type
- `sources/config/configResolve.ts` — feature defaults
- `sources/config/configSettingsParse.ts` — Zod validation
- `sources/prompts/SYSTEM.md` — Handlebars system prompt template
- `sources/engine/agents/agent.ts` — `buildSystemPrompt()` context, `listContextTools()`
- `sources/engine/agents/ops/agentLoopRun.ts` — inference loop (tag extraction + execution)
- `sources/engine/modules/tools/toolListContextBuild.ts` — tool list filtering
- `sources/engine/modules/rlm/rlmExecute.ts` — Python execution (reused as-is)
- `sources/engine/modules/rlm/rlmPreambleBuild.ts` — generates Python stubs (reused)
- `sources/engine/modules/rlm/rlmToolDescriptionBuild.ts` — tool description builder (reference for system prompt content)
- `sources/engine/modules/rlm/rlmResultTextBuild.ts` — result formatting (reused)
- `sources/engine/modules/rlm/rlmErrorTextBuild.ts` — error formatting (reused)
- `sources/engine/engine.ts` — tool registration (no changes needed)
- `sources/util/tagExtract.ts` — tag extraction utility (reused as-is)

**Patterns found:**
- Feature flags: simple boolean fields in `FeaturesConfig`, resolved with defaults in `configResolve()`
- Tag extraction: `tagExtract(text, tag)` finds first open + last close, returns inner content trimmed
- System prompt: Handlebars template with `features` object in context
- `<say>` tag mode: already extracts tags from response text and coexists with tool calls
- `rlmExecute()` is decoupled from the tool entry point — takes code + preamble + toolResolver directly

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

- **Unit tests**: required for every task
- Focus on pure functions: tag extraction logic, system prompt building, noTools tool list filtering
- Integration-style tests for the noTools loop behavior in `agentLoopRun`

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `features.noTools` feature flag

- [x] Add `noTools?: boolean` to `FeaturesConfig` type in `sources/settings.ts`
- [x] Add default `noTools: false` in `resolveSettingsDefaults()` in `sources/config/configResolve.ts`
- [x] Add `noTools: z.boolean().optional()` to features schema in `sources/config/configSettingsParse.ts`
- [x] Write test for `configSettingsParse` accepting `features.noTools`
- [x] Write test for `configResolve` defaulting `noTools` to false
- [x] Run tests — must pass before task 2

### Task 2: Return empty tool list in noTools mode

- [x] Add `noTools?: boolean` option to `ToolListOptions` in `sources/engine/modules/tools/toolListContextBuild.ts`
- [x] Add early return `[]` when `options.noTools` is true (before the `rlm` check)
- [x] Pass `noTools` flag from `agentLoopRun.ts` (line 133) — read from `rlmNoToolsModeIs(features)` (`noTools && rlm && say`)
- [x] Pass `noTools` flag from `agent.ts` `listContextTools()` (line 1098)
- [x] Write test for `toolListContextBuild` returning `[]` when `noTools: true`
- [x] Run tests — must pass before task 3

### Task 3: Add `<run_python>` instructions to system prompt

- [x] Create `rlmNoToolsPromptBuild.ts` in `sources/engine/modules/rlm/` — builds the system prompt section with Python function stubs + `<run_python>` tag usage instructions. Takes `tools: Tool[]` and `skills: AgentSkill[]`, reuses `rlmPreambleBuild()` for stubs. Instructs model: write code in `<run_python>` tags, first open + last close extracted, no escaping needed. Results arrive in `<python_result>` tags as user messages.
- [x] Add `noToolsPrompt?: string` to `AgentSystemPromptContext` type in `agent.ts`
- [x] In `buildSystemPrompt()`, add `noToolsPrompt` to `templateContext`
- [x] In `agent.ts` `handleMessage()`, when `rlmNoToolsModeIs(features)` is true (`noTools && rlm && say`), call `rlmNoToolsPromptBuild()` with the tool list and pass result as `noToolsPrompt` to `buildSystemPrompt()`
- [x] Add `{{#if noToolsPrompt}}` section in `SYSTEM.md` — place it after the "Tool Call Style" section, render the prebuilt prompt with triple-stash `{{{noToolsPrompt}}}`
- [x] Write test for `rlmNoToolsPromptBuild` producing correct output with tool stubs
- [x] Run tests — must pass before task 4

### Task 4: Extract `<run_python>` tags and execute in inference loop

- [x] Create `rlmNoToolsExtract.ts` in `sources/engine/modules/rlm/` — extracts Python code from response text using `tagExtract(text, "run_python")`, returns `string | null`
- [x] Create `rlmNoToolsResultMessageBuild.ts` in `sources/engine/modules/rlm/` — builds a user-role message containing `<python_result>...</python_result>` with the execution result text (uses `rlmResultTextBuild` for success, `rlmErrorTextBuild` for errors)
- [x] In `agentLoopRun.ts`, after extracting `responseText` and before checking `toolCalls.length === 0`:
  - When `rlmNoToolsModeIs(features)` is true (`noTools && rlm && say`), call `rlmNoToolsExtract(responseText)`
  - If code found: build preamble via `rlmPreambleBuild(toolResolver.listTools())`, call `rlmExecute()` with the extracted code, format result, push user message with `<python_result>` to `context.messages`, `continue` the loop
  - If code not found AND no tool calls: break as usual
- [x] Handle errors from `rlmExecute()` — catch and inject error text in `<python_result>` tags
- [x] Write history records: reuse existing `appendHistoryRecord` callback passed to `rlmExecute()`
- [x] Generate unique `toolCallId` via `createId()` for checkpointing
- [x] Write test for `rlmNoToolsExtract` (code found, no code, partial tags)
- [x] Write test for `rlmNoToolsResultMessageBuild` (success result, error result)
- [x] Run tests — must pass before task 5

### Task 5: Handle `<say>` + `<run_python>` coexistence

- [x] Verify behavior: when both `features.say` and `features.noTools` are enabled, `<say>` tags should be processed for user output AND `<run_python>` tags should be extracted for execution from the same response
- [x] Ensure `<run_python>` extraction runs regardless of `<say>` processing (check ordering in the loop)
- [x] If the response contains `<run_python>`, do NOT suppress user output from `<say>` tags that appeared before the code block — process `<say>` first, then extract and execute `<run_python>`
- [x] Write test covering a response with both `<say>` and `<run_python>` tags
- [x] Run tests — must pass before task 6

### Task 6: Verify acceptance criteria

- [x] Verify: `features.noTools`, `features.rlm`, and `features.say` all true causes model to receive zero tools
- [x] Verify: system prompt includes Python function stubs and `<run_python>` tag instructions
- [x] Verify: `<run_python>` code in response text is extracted and executed via Monty
- [x] Verify: execution result is injected as user message with `<python_result>` tags
- [x] Verify: inference loop continues after execution (model gets another turn)
- [x] Verify: `features.rlm` (tool-based) still works independently
- [x] Verify: `features.say` coexists with `features.noTools`
- [x] Verify: RLM checkpointing works (history records written)
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed (N/A: no lint script is defined in this workspace)

### Task 7: [Final] Update documentation

- [x] Update `doc/internals/features-config.md` with `noTools` flag documentation
- [x] Create `doc/internals/rlm-notool-tags.md` with architecture overview and Mermaid diagram
- [x] Update `sources/engine/modules/rlm/README.md` to document the tag-based mode

## Technical Details

### Tag extraction

```
Model response: "Let me check that. <run_python>result = echo("hello")\nprint(result)</run_python>"
                                      ^first open tag                    ^last close tag
Extracted code: 'result = echo("hello")\nprint(result)'
```

Uses existing `tagExtract(text, "run_python")` — finds first `<run_python>` and last `</run_python>`, returns trimmed inner content. No escaping rules.

### Execution flow (noTools mode)

```
1. Model receives: system prompt (with Python stubs + <run_python> instructions), zero tools
2. Model responds: text with <run_python>code here</run_python>
3. Loop extracts code via tagExtract()
4. Loop calls rlmExecute(code, preamble, context, toolResolver, id, historyCallback)
5. Monty VM runs code, dispatches inner tool calls through toolResolver
6. Result formatted via rlmResultTextBuild() or rlmErrorTextBuild()
7. User message injected: "<python_result>output here</python_result>"
8. Loop continues (goto step 2)
9. Model responds without <run_python> tags → loop ends
```

### System prompt section (noTools mode)

```markdown
## Python Execution

Write Python code inside `<run_python>` tags to execute it. The system extracts everything between the first `<run_python>` and last `</run_python>` — no escaping needed.

Available functions:
\```python
# tool stubs generated by rlmPreambleBuild()
\```

Call functions directly (no `await`). Use `try/except ToolError` for failures.
Use `print()` for debug output. The final expression value is returned.
Results arrive as `<python_result>` messages.
```

### Result injection format

```xml
<python_result>
Python execution completed.
Tool calls: 2
Print output:
hello world
Output: success
</python_result>
```

Or on error:

```xml
<python_result>
Python execution failed.
RuntimeError: ToolError: Unknown tool: foo
</python_result>
```

### Feature flag combinations

| `features.noTools` | `features.rlm` | `features.say` | Behavior |
|---|---|---|---|
| false | false | false | Normal tool-call mode (default) |
| false | true | false/true | RLM tool-call mode (existing) |
| true | false | false/true | Normal mode (no tag-based RLM; noTools gate not satisfied) |
| true | true | false | RLM tool-call mode (tag-based RLM gate not satisfied) |
| true | true | true | noTools tag mode (zero tools, `<run_python>` tags enabled) |

## Post-Completion

**Manual verification:**
- Test with a real model conversation: enable `features.noTools`, `features.rlm`, and `features.say`; verify model uses `<run_python>` tags
- Test tool dispatch within Python code works (e.g., `echo("hello")`)
- Test multi-turn execution (model writes code, gets result, writes more code)
- Test error handling (syntax errors, runtime errors, unknown tools)
- Test with `features.say` enabled alongside `features.noTools` and `features.rlm`
