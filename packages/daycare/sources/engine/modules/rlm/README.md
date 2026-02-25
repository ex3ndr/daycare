# RLM (run_python)

Daycare uses inline RLM only:

- inference sees zero classical tools
- Python is authored in `<run_python>...</run_python>` blocks in assistant text
- execution results are injected as `<python_result>...</python_result>` user messages
- regular Daycare tools stay registered internally and are callable by Python code

Multiple `<run_python>` blocks in one assistant message execute sequentially.
The first failed block stops execution of remaining blocks in that same message.
Any `<say>` tags after the first `<run_python>` are trimmed.

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

Execution uses a separate runtime preamble from `montyRuntimePreambleBuild()` that excludes
prompt comments and includes compact `TYPE_CHECKING`-guarded function stubs so runtime preamble
still carries callable tool names/signatures.

RLM prompt builders no longer embed skill lists. Skills are injected once via
`skillPromptFormat()` into the dedicated skills section during system-prompt section rendering.

At execution time, the active runtime tool resolver from current tool execution context is used
when available (for example app/subagent tool overrides). This keeps Python tool stubs and
dispatch aligned with the active sandboxed tool view.

## Execution Flow

`rlmExecute()` uses Monty's iterative `start()`/`resume()` loop:

1. Start Monty with `runtime_preamble + user code`
2. On `MontySnapshot`, dispatch `functionName` through `ToolResolver.execute()`
3. Resume with `returnValue` or a `ToolError` exception
4. Return final output, captured prints, and tool-call count

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
- `rlm_tool_call`: snapshot before each inner tool call
- `rlm_tool_result`: inner tool result after each call
- `rlm_complete`: terminal execution record (success or error)

On process restart, incomplete RLM runs are detected and resumed from the latest
`rlm_tool_call.snapshot`. The first resumed frame receives a runtime exception with
message `Process was restarted`, so Python can catch `ToolError` or fail normally.

Recovery appends:

- synthetic outer `tool_result` for the original `run_python` call
- synthetic user-side system message with `origin="rlm_restore"`
