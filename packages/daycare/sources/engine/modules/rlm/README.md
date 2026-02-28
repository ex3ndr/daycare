# RLM (run_python)

Daycare uses inline RLM only:

- inference sees zero classical tools
- Python is authored in `<run_python>...</run_python>` blocks in assistant text
- execution results are injected as `<python_result>...</python_result>` user messages
- regular Daycare tools stay registered internally and are callable by Python code

Multiple `<run_python>` blocks in one assistant message execute sequentially.
The first failed block stops execution of remaining blocks in that same message.

## Tool Stub Generation

`montyPreambleBuild()` (in `engine/modules/monty`) generates Python prompt stubs from the current
`ToolResolver.listTools()` output.
Each stub is rendered as:

```python
def tool_name(arg1: type, arg2: type) -> ToolResponse:
    """Tool description"""
    raise NotImplementedError(...)
```

The preamble is regenerated from the current tool set and rendered through
`sources/prompts/SYSTEM_TOOLS_RLM_INLINE.md`.

Shared Python execution instructions (calling conventions, error handling, print usage) live in
`sources/prompts/TOOLS_PYTHON.md` and are injected via `{{{pythonTools}}}`.

Execution uses `montyPreambleBuild()` output as Monty `typeCheckPrefixCode`.
Tool stubs and `TypedDict` types are used for type checking only; runtime executes
only user code (plus minimal runtime aliases like `ToolError`).
`rlmVerify()` performs Monty type checking without execution for `task_create` validation.

RLM prompt builders no longer embed skill lists. Skills are injected once via
`skillPromptFormat()` into the dedicated skills section during system-prompt section rendering.

At execution time, the active runtime tool resolver from current tool execution context is used
when available (for example app/subagent tool overrides). This keeps Python tool stubs and
dispatch aligned with the active sandboxed tool view.

## Execution Flow

`rlmExecute()` is a convenience wrapper over step primitives used by the flat agent loop:

1. `rlmStepStart()` starts VM execution and returns paused snapshot state or completion
2. `rlmStepToolCall()` executes one paused tool call and builds resume options
3. `rlmStepResume()` reloads snapshot bytes in worker and resumes VM
4. `rlmExecute()` loops over those primitives for non-agent-loop callers

## Worker Isolation

Monty VM execution runs in dedicated child worker processes managed by `RlmWorkers`:

- each agent context (`ctx.userId + ctx.agentId`) gets its own worker process key
- `rlmStepStart()` and `rlmStepResume()` route requests through the per-agent worker
- host process keeps tool execution/orchestration logic and only delegates VM start/resume
- worker crashes are isolated from the host process; in-flight requests fail and next request respawns worker

## Print Handling

Monty 0.0.4 does not expose print callbacks in `start()` options. RLM captures prints by
injecting a Python `print()` shim that calls a hidden external function and records output lines.

## Resource Limits

RLM execution limits:
- `maxDurationSecs`: `30`
- `maxMemory`: `50 * 1024 * 1024`
- `maxRecursionDepth`: `100`
- `maxAllocations`: `1_000_000`

`maxDurationSecs` is enforced per interpreter segment. After each external tool
call returns, the snapshot is reloaded before `resume()`, so waiting time spent
inside the external Daycare tool does not count against the 30-second budget.

## Error Handling

- `MontySyntaxError`: returned as tool error with a "fix and retry" hint
- `MontyRuntimeError`: returned as tool error with traceback output
- Tool execution errors: resumed into Python as `ToolError`, so user code can catch them via
  `try/except ToolError`

## Checkpointing and Restore

RLM now persists execution checkpoints into agent history:

- `rlm_start`: run metadata (`toolCallId`, code, preamble)
- `rlm_tool_call`: persisted cuid2 `snapshotId` (dump stored under agent/session folder by `rlmSnapshotSave` with explicit `sessionId`)
- `rlm_tool_result`: inner tool result after each call
- `rlm_complete`: terminal execution record (success or error)

On process restart, agent restore resolves a pending loop phase:
- `vm_start`: assistant message was persisted but VM never started
- `tool_call`: VM snapshot file is loaded by explicit session id + snapshot id and resumes with `RuntimeError("Process was restarted")`
- `error`: start record exists but no snapshot, so recovery appends failed `rlm_complete`
