# Remove Legacy Non-Inline-RLM Operation Modes

## Overview
- Remove all legacy operation mode combinations, hardcoding `say: true, rlm: true, noTools: true` as the only execution path
- Delete the `FeaturesConfig` type and all feature flag plumbing — there is no mode selection anymore
- Aggressively remove classical tool calling infrastructure (tool call extraction, classical tool execution loop, `rlmToolOnly` guards)
- Delete classical-RLM-only support files (`rlmTool.ts`, `rlmToolDescriptionBuild.ts`)
- The inline-RLM path (`<run_python>` tags parsed from assistant text, executed via `rlmExecute`) becomes the sole execution engine

## Context
- **Mode flag type**: `FeaturesConfig` in `sources/settings.ts` with `say`, `rlm`, `noTools` booleans
- **Mode check**: `rlmNoToolsModeIs()` in `sources/engine/modules/rlm/rlmNoToolsModeIs.ts`
- **Main loop**: `agentLoopRun.ts` has two code paths — inline-RLM (lines 470-565) and classical tools (lines 568-755)
- **Config resolution**: `configResolve.ts` defaults all flags to `false`; `configSettingsParse.ts` parses them from YAML
- **Engine registration**: `engine.ts` conditionally registers `rlmToolBuild()` when `features.rlm` is true
- **Tool list building**: `toolListContextBuild.ts` branches on `noTools`/`rlm` flags to decide what tools to expose to inference
- **History context**: `agentHistoryContext.ts` skips all RLM records, rebuilds from classical `tool_result` records
- **Classical-RLM-only files**: `rlmTool.ts`, `rlmToolDescriptionBuild.ts`
- **Shared RLM files (kept — used by inline-RLM)**: `rlmConvert.ts`, `rlmToolResultBuild.ts`, `rlmToolsForContextResolve.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change

## Testing Strategy
- **Unit tests**: required for every task
- Existing tests for removed files will be deleted alongside the files
- Tests for modified files (e.g. `agentLoopRun`, `toolResolver`, `engine`) must be updated to reflect the single-mode behavior

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Remove FeaturesConfig and feature flag plumbing
- [x] Delete `FeaturesConfig` and `ResolvedFeaturesConfig` types from `sources/settings.ts`
- [x] Remove `features` field from `SettingsConfig` and `ResolvedSettingsConfig` in `sources/settings.ts`
- [x] Remove `features` parsing from `configSettingsParse.ts` (the zod schema block)
- [x] Remove `features` resolution from `configResolve.ts` (the defaults block)
- [x] Remove `features` from the `Config` type and its construction in `configResolve.ts`
- [x] Delete `rlmNoToolsModeIs.ts` and its spec file `rlmNoToolsModeIs.spec.ts`
- [x] Find and update all imports of `rlmNoToolsModeIs` — replace calls with `true` or remove the conditional entirely
- [x] Find and update all reads of `config.current.features.*` — remove conditionals, keep the "true" branch
- [x] Run tests — must pass before next task

### Task 2: Delete classical-RLM-only tool files
- [x] Delete `sources/engine/modules/rlm/rlmTool.ts` and `rlmTool.spec.ts`
- [x] Delete `sources/engine/modules/rlm/rlmToolDescriptionBuild.ts` and `rlmToolDescriptionBuild.spec.ts`
- [x] Remove `rlmToolBuild` import and conditional registration from `engine.ts` (lines 436-438)
- [x] Remove all dangling imports of deleted files across the codebase
- [x] Run tests — must pass before next task

Note: `rlmConvert.ts`, `rlmToolResultBuild.ts`, and `rlmToolsForContextResolve.ts` are **shared infrastructure** used by the inline-RLM path (`rlmExecute.ts`, `rlmRestore.ts`, `agent.ts`, `executablePromptExpand.ts`) and must NOT be deleted.

### Task 3: Delete classical tool calling infrastructure
- [x] Delete `sources/engine/messages/messageExtractToolCalls.ts` (and spec if exists)
- [x] Delete `sources/engine/agents/ops/agentHistoryPendingToolResults.ts` (and spec if exists)
- [x] Remove `rlmToolOnly` field from `ToolExecutionContext` in `sources/engine/modules/tools/types.ts`
- [x] Remove the `rlmToolOnly` guard in `toolResolver.ts` (lines 70-72)
- [x] Remove `skipToolBuild` registration and import from `engine.ts` — the skip tool is only needed as a classical tool; inline-RLM calls `skip()` as a Python function
- [x] Delete `sources/engine/modules/tools/skipTool.ts` (and spec if exists)
- [x] Remove all dangling imports of deleted files
- [x] Update tests for `toolResolver` to remove `rlmToolOnly` test cases
- [x] Run tests — must pass before next task

### Task 4: Simplify toolListContextBuild to inline-RLM only
- [x] Remove the three-way branching in `toolListContextBuild.ts` — always return empty tool array (the `noTools` path)
- [x] Delete `toolListRlmBuild` helper function (no longer needed)
- [x] Remove `rlm`, `noTools`, `rlmToolDescription` from the options type
- [x] Simplify or delete `toolListVisibleResolve` and `toolListAllowlistApply` if they become trivial
- [x] Update tests for `toolListContextBuild` to reflect single behavior
- [x] Run tests — must pass before next task

### Task 5: Simplify agentLoopRun — remove classical tool execution
- [x] Remove the classical tool calling block (lines ~568-755) — the `for (toolCalls)` loop, tool execution, skip detection, steering in tool loop
- [x] Remove `messageExtractToolCalls` import and `const toolCalls = ...` extraction (line 295)
- [x] Remove `rlmToolDescription` variable and `rlmToolDescriptionBuild` call (lines 160-163)
- [x] Remove `noToolsModeEnabled` variable — all mode guards become unconditional
- [x] Remove `lastResponseHadToolCalls` tracking (only used for classical tool loop exceeded message)
- [x] Simplify the inline-RLM block to be the default path (remove the `if (noToolsModeEnabled)` wrapper)
- [x] Simplify say-tag handling — `sayEnabled` always true for foreground agents (remove `features.say` check)
- [x] Remove `agentHistoryPendingToolResults` import and usage
- [x] Remove stop sequence conditional — always pass `stop: ["</run_python>"]`
- [x] Update or write tests covering the simplified loop behavior
- [x] Run tests — must pass before next task

### Task 6: Simplify agentToolExecutionAllowlistResolve
- [x] Remove `rlmEnabled` option — RLM is always enabled
- [x] Remove `RLM_TOOL_NAME` and `SKIP_TOOL_NAME` additions to allowlist (these were classical tool names)
- [x] Keep memory-agent allowlist logic (memory_node_read/write restrictions still apply within RLM execution)
- [x] Update callers to stop passing `rlmEnabled`
- [x] Update tests
- [x] Run tests — must pass before next task

### Task 7: Simplify system prompt generation
- [x] In `agentSystemPromptSectionToolCalling.ts` — always generate inline-RLM prompt (remove conditional)
- [x] In `agentSystemPromptSectionFormatting.ts` — always enable say-tag formatting (remove `features.say` check)
- [x] Remove references to `SYSTEM_TOOLS_RLM.md` prompt template (classical RLM description) if it exists separately from `SYSTEM_TOOLS_RLM_INLINE.md`
- [x] Update tests for system prompt sections
- [x] Run tests — must pass before next task

### Task 8: Clean up history and remaining references
- [x] In `agentHistoryContext.ts` — the RLM record skipping is correct behavior (RLM records are execution details, not context); verify no classical `tool_result` records are expected in the new mode
- [x] In `agentHistorySummary.ts` — keep `tool_result` counting (RLM still generates tool results internally); clean up any classical-only counts if present
- [x] In `agent.ts` — remove `agentHistoryPendingToolResults` import and usage for crash recovery
- [x] In `agentHistoryPendingRlmResolve.ts` — keep as-is (still needed for RLM crash recovery)
- [x] Clean up `SKIP_TOOL_NAME` and `RLM_TOOL_NAME` constant usage — keep `RLM_TOOL_NAME` if used by inline-RLM, remove `SKIP_TOOL_NAME` if only classical
- [x] Check `appToolExecutorBuild.ts` and `appToolReview.ts` — update RLM references if needed
- [x] Check `recipe/` files for mode references and simplify
- [x] Check `executablePromptExpand.ts` for mode references
- [x] Check `formatHistoryMessages.ts` in memory module for mode references
- [x] Run tests — must pass before next task

### Task 9: Verify acceptance criteria
- [x] Verify: no references to `features.say`, `features.rlm`, `features.noTools` remain in source code
- [x] Verify: no references to `FeaturesConfig` or `ResolvedFeaturesConfig` remain
- [x] Verify: `rlmNoToolsModeIs` function is deleted and not referenced
- [x] Verify: `messageExtractToolCalls` is deleted and not referenced
- [x] Verify: no classical tool calling loop exists in `agentLoopRun.ts`
- [x] Verify: the only tool execution path is via `rlmExecute` for `<run_python>` blocks
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`) — all issues must be fixed
- [x] Run typecheck (`yarn typecheck`) — must pass

### Task 10: Update documentation
- [x] Update `doc/PLUGINS.md` if it references feature flags or tool calling modes
- [x] Update any README or doc files that reference `say`, `rlm`, `noTools` configuration
- [x] Add note to this plan file marking completion

## Technical Details

### What stays (inline-RLM infrastructure)
- `rlmExecute.ts` — core Python execution engine
- `rlmConvert.ts` — Monty argument/result conversion (used by `rlmExecute.ts`, `rlmRestore.ts`)
- `rlmToolResultBuild.ts` — result builder (used by `agent.ts` crash recovery)
- `rlmToolsForContextResolve.ts` — visible tools filter (used by `rlmExecute.ts`, `rlmRestore.ts`, `executablePromptExpand.ts`, `agent.ts`)
- `rlmNoToolsExtract.ts` — extracts `<run_python>` blocks from text
- `rlmNoToolsPromptBuild.ts` — builds inline-RLM system prompt
- `rlmNoToolsResultMessageBuild.ts` — wraps execution results
- `rlmConstants.ts` — `RLM_TOOL_NAME` constant (used by inline execution)
- `rlmRestore.ts` — crash recovery for incomplete RLM executions
- `rlmErrorTextBuild.ts` — error formatting
- `rlmHistoryCompleteErrorRecordBuild.ts` — error history records
- `rlmResultTextBuild.ts` — result formatting
- All `say/` module files — say-tag extraction and file resolution
- `montyPreambleBuild.ts`, `montyRuntimePreambleBuild.ts` — Python runtime preamble

### What gets deleted
- `rlmTool.ts` + spec — classical `run_python` tool definition
- `rlmToolDescriptionBuild.ts` + spec — dynamic tool description for classical RLM
- `rlmNoToolsModeIs.ts` + spec — mode detection (always true now)
- `messageExtractToolCalls.ts` — classical tool call extraction
- `agentHistoryPendingToolResults.ts` — pending classical tool results
- `skipTool.ts` — classical skip tool definition

### Processing flow (after refactor)
```
User message → agentLoopRun
  → Build system prompt (always inline-RLM + say-tag)
  → Build tool list (always empty — no classical tools)
  → Inference call with stop: ["</run_python>"]
  → Extract <say> blocks → send to connector
  → Extract <run_python> blocks → rlmExecute each
  → Push rlmNoToolsResultMessage into context
  → Loop continues until no <run_python> tags or max iterations
  → Final response via say-tag or fallback
```

## Post-Completion

**Manual verification:**
- Test with a live agent to confirm `<run_python>` execution works end-to-end
- Test say-tag output delivery to connectors (Telegram, WhatsApp)
- Verify crash recovery (kill agent mid-RLM, restart, confirm `rlmRestore` resumes)
- Verify background agents (heartbeat, cron) work without say-tag output

**Configuration cleanup:**
- Remove `features` block from any deployed YAML config files
- Notify operators that `features.say`, `features.rlm`, `features.noTools` config keys are no longer recognized

## Completion Note (2026-02-25)
- Implemented across `packages/daycare` and docs with legacy non-inline modes removed.
- Verification commands run successfully:
  - `yarn lint` (repo root)
  - `yarn typecheck` (`packages/daycare`)
  - `yarn test` (`packages/daycare`)
- Acceptance-gate source scans returned no matches for:
  - `features.say`, `features.rlm`, `features.noTools`
  - `FeaturesConfig`, `ResolvedFeaturesConfig`
  - `rlmNoToolsModeIs`
  - `messageExtractToolCalls`
