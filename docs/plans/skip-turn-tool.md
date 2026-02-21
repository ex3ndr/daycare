# Skip Turn Tool

## Overview
Add a new global tool `skip` that models can call to skip a turn. When invoked:
- The agent loop stops immediately (no further inference).
- A user-role message "Turn skipped" is appended to context after the tool result, so the model sees it on the next turn.
- History is saved normally.
- In RLM mode, calling `skip()` from Python aborts the RLM execution completely.

## Context
- Global tools are registered in `engine.ts` via `modules.tools.register("core", ...)`
- Tool definitions follow the pattern in `sources/engine/modules/tools/types.ts`
- RLM mode filters the tool list to only `run_python` in `toolListContextBuild.ts`
- The `rlmToolOnly` gate in `toolResolver.ts` restricts direct tool calls to `run_python` when RLM is enabled
- RLM execution in `rlmExecute.ts` dispatches Python function calls to registered tools
- The agent loop in `agentLoopRun.ts` controls inference iterations and tool execution

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Create the skip tool definition
- [ ] Create `sources/engine/modules/tools/skipTool.ts` with `skipToolBuild()` function
- [ ] Tool name: `"skip"`, no parameters (empty object schema), returns `{ status: "skipped" }`
- [ ] Description: "Skip this turn. Call when you have nothing useful to do right now."
- [ ] Execute function returns a simple success result
- [ ] Add `SKIP_TOOL_NAME` constant to `sources/engine/modules/rlm/rlmConstants.ts`
- [ ] Write tests in `skipTool.spec.ts`
- [ ] Run tests - must pass before next task

### Task 2: Allow skip through the RLM tool gate
- [ ] In `toolResolver.ts`, update the `rlmToolOnly` check (line 68) to also allow `SKIP_TOOL_NAME`
- [ ] In `toolListContextBuild.ts`, update `toolListRlmBuild` to include the `skip` tool alongside `run_python`
- [ ] Update existing tests in `toolResolver.spec.ts` to cover skip being allowed in rlmToolOnly mode
- [ ] Run tests - must pass before next task

### Task 3: Handle skip in RLM execution
- [ ] In `rlmExecute.ts`, add a check for `progress.functionName === SKIP_TOOL_NAME` in the while loop (before tool dispatch)
- [ ] When skip is detected: record `rlm_complete` history, return result with `skipTurn: true` flag
- [ ] Add `skipTurn?: boolean` to `RlmExecuteResult` type
- [ ] Write tests for rlmExecute skip handling
- [ ] Run tests - must pass before next task

### Task 4: Handle skip in agent loop (both modes)
- [ ] In `agentLoopRun.ts` non-RLM tool execution loop: after executing a tool named `"skip"`, append "Turn skipped" user message to context, break the loop
- [ ] In `agentLoopRun.ts` RLM no-tools path: after `rlmExecute` returns with `skipTurn: true`, append "Turn skipped" user message to context, break the loop
- [ ] In `agentLoopRun.ts` RLM tool-call path: after tool result for `run_python`, check if RLM result had `skipTurn` — handle same way (this path uses `rlmTool.ts`, need to propagate the flag)
- [ ] Write/update tests in `agentLoopRun.spec.ts`
- [ ] Run tests - must pass before next task

### Task 5: Register the tool and verify
- [ ] In `engine.ts`, add `skipToolBuild()` registration alongside other core tools
- [ ] Add import for `skipToolBuild`
- [ ] Run full test suite
- [ ] Run linter

### Task 6: Update documentation
- [ ] Update relevant docs in `/doc/` if needed
- [ ] Document the skip tool behavior

## Technical Details

### Skip Tool Schema
```typescript
// No parameters
const schema = Type.Object({}, { additionalProperties: false });

// Returns
const resultSchema = Type.Object(
    { status: Type.String() },
    { additionalProperties: false }
);
```

### RLM Execution Abort Flow
```
Python code calls skip()
  → rlmExecute detects functionName === "skip"
  → records rlm_complete history
  → returns { output: "Turn skipped", skipTurn: true, ... }
  → agentLoopRun detects skipTurn
  → appends user message "Turn skipped" to context
  → breaks loop (no further inference)
```

### Non-RLM Skip Flow
```
Model calls skip tool
  → toolResolver executes skipTool
  → tool result appended to context
  → agentLoopRun detects toolCall.name === "skip"
  → appends user message "Turn skipped" to context
  → breaks loop (no further inference)
```

### Context After Skip (what model sees next turn)
```
[...previous messages...]
assistant: [called skip tool]
toolResult: { status: "skipped" }
user: "Turn skipped"
```
