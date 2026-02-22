# Output Truncation Overhaul

## Overview
- Tool and exec outputs are not carefully truncated before entering the LLM context, risking context blowup
- The current 4,000 char head-only truncation loses critical information (errors at tail, stderr)
- RLM `<python_result>` messages bypass truncation entirely and can inject unbounded text into context
- This plan introduces unified, strategy-aware truncation with head+tail for RLM and tail-biased for exec

## Context (from discovery)
- **Exec tool**: `plugins/shell/tool.ts` — captures 1 MB buffer, formats stdout+stderr, puts full text in toolMessage
- **Tool result truncation**: `engine/modules/tools/toolResultTruncate.ts` — 4,000 char head-only cut on toolMessage.content
- **RLM result text**: `engine/modules/rlm/rlmResultTextBuild.ts` — builds unbounded text from printOutput + output
- **RLM no-tools injection**: `engine/modules/rlm/rlmNoToolsResultMessageBuild.ts` — injects `<python_result>` as user message, NO truncation
- **RLM tool mode**: `engine/modules/rlm/rlmTool.ts` → `rlmToolResultBuild.ts` — puts text in toolMessage.content, subject to toolResultTruncate
- **String utility**: `utils/stringTruncate.ts` — simple head-only `slice(0, max) + "..."`
- **Monty Python tool**: `plugins/monty-python/tool.ts` — has its own 50,000 char limit via stringTruncate

## Problems identified

1. **Exec truncation is tail-blind**: `formatExecOutput` puts stdout first, stderr second. Head-only truncation at 4K chars means stderr (with errors) is always lost for large outputs.
2. **RLM `<python_result>` is unbounded**: `rlmNoToolsResultMessageBuild` injects directly into context as a user message — `toolResultTruncate` never runs on it. Print output accumulating over many tool calls can grow without limit.
3. **`toolResultTruncate` only handles single text blocks**: Multi-block content (text + image) passes through completely untruncated.
4. **No indication of what was lost**: Truncation notice is generic `"Command output was truncated"` with no size info.
5. **`stringTruncate` utility is head-only**: Used by Monty Python (50K limit) and verbose logging, always loses the tail.

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility

## Implementation Steps

### Task 1: Create `stringTruncateTail` and `stringTruncateHeadTail` utilities
- [ ] Create `utils/stringTruncateTail.ts` — keeps the last N chars, prepends `"... (X chars truncated)\n"`
- [ ] Create `utils/stringTruncateHeadTail.ts` — keeps first N/2 chars + last N/2 chars with `"\n\n... (X chars truncated) ...\n\n"` separator
- [ ] Write tests for `stringTruncateTail` (short input unchanged, long input keeps tail, notice includes char count)
- [ ] Write tests for `stringTruncateHeadTail` (short input unchanged, long input keeps head+tail, notice includes char count)
- [ ] Run tests — must pass before next task

### Task 2: Overhaul `toolResultTruncate` — increase limit, use tail-biased strategy, handle multi-block
- [ ] Change `MAX_TOOL_RESULT_CHARS` from 4,000 to 8,000
- [ ] Change truncation strategy to **tail-biased**: keep the last 8,000 chars (using `stringTruncateTail`) since exec errors/results appear at the end
- [ ] Handle multi-block content: iterate all text blocks, truncate each one individually, sum total text size
- [ ] Improve truncation notice: include original size info (e.g., `"\n\n... (42,381 chars truncated from output)"`)
- [ ] Update existing tests to reflect new limit, tail strategy, and notice format
- [ ] Add test for multi-block content truncation
- [ ] Run tests — must pass before next task

### Task 3: Truncate exec output before building toolMessage
- [ ] In `tool.ts` `formatExecOutput`: apply tail truncation (8,000 chars) to stdout and stderr **individually** before combining, so both streams are represented in the output
- [ ] Include stream labels in truncation notices (e.g., `"... (12,000 chars truncated from stdout)"`)
- [ ] Update or add tests for `formatExecOutput` with large stdout, large stderr, and both large
- [ ] Run tests — must pass before next task

### Task 4: Truncate RLM `<python_result>` output (no-tools mode)
- [ ] In `rlmResultTextBuild.ts`: apply head+tail truncation (16,000 chars total) to the combined result text
- [ ] Truncate `printOutput` array: join, then apply head+tail truncation with 8,000 char sub-limit
- [ ] Truncate `result.output`: apply head+tail truncation with 8,000 char sub-limit
- [ ] Update or add tests for `rlmResultTextBuild` with large printOutput, large output, and both large
- [ ] Run tests — must pass before next task

### Task 5: Truncate RLM tool mode output
- [ ] In `rlmToolResultBuild.ts` or `rlmTool.ts`: apply head+tail truncation (16,000 chars) to text before building toolMessage (so `toolResultTruncate` has less work, and `typedResult.summary` is also bounded)
- [ ] Update or add tests
- [ ] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [ ] Verify exec output is tail-truncated at 8,000 chars with stderr preserved
- [ ] Verify RLM `<python_result>` is bounded at 16,000 chars with head+tail strategy
- [ ] Verify RLM tool mode output is bounded at 16,000 chars with head+tail strategy
- [ ] Verify multi-block tool results are truncated
- [ ] Verify truncation notices include original size info
- [ ] Run full test suite (unit tests)
- [ ] Run linter — all issues must be fixed
- [ ] Run typecheck — must pass

### Task 7: [Final] Update documentation
- [ ] Update `doc/internals/inference.md` to reflect new truncation limits and strategies
- [ ] Add a section to plugin README or doc about output size expectations

## Technical Details

### Truncation strategies by path

| Path | Strategy | Limit | Rationale |
|------|----------|-------|-----------|
| `toolResultTruncate` (all tools) | Tail-biased | 8,000 chars | Errors/results appear at end of output |
| `formatExecOutput` (exec tool) | Per-stream tail | 8,000 chars each | Preserve both stdout and stderr tails |
| `rlmResultTextBuild` (RLM) | Head + tail | 16,000 chars total | Need beginning (context) and end (results) |
| `rlmToolResultBuild` (RLM tool) | Head + tail | 16,000 chars | Same as above |

### Truncation notice format
```
... (12,345 chars truncated from output)
```

### Data flow after changes
```
exec command
  → stdout (1MB max buffer)
  → stderr (1MB max buffer)
  → formatExecOutput: tail-truncate each stream to 8K
  → toolMessage.content: combined text
  → toolResultTruncate: tail-truncate to 8K (safety net)
  → LLM context

run_python (no-tools mode)
  → rlmExecute → printOutput[] + output
  → rlmResultTextBuild: head+tail truncate to 16K
  → rlmNoToolsResultMessageBuild: wrap in <python_result>
  → context.messages (user role)

run_python (tool mode)
  → rlmExecute → printOutput[] + output
  → rlmResultTextBuild: head+tail truncate to 16K
  → rlmToolResultBuild → toolMessage
  → toolResultTruncate: tail-truncate to 8K (safety net)
  → LLM context
```

## Post-Completion

**Manual verification:**
- Run a real exec command producing >8K output and verify LLM sees the tail
- Run an RLM script with many print() calls and verify output is bounded
- Verify context does not overflow during extended agent sessions
