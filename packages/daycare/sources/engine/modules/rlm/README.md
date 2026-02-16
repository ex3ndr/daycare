# RLM (run_python)

RLM mode exposes a single `run_python` tool to the model. The model writes Monty-compatible
Python and calls normal Daycare tools through generated sync stubs.

## Enable

Set `rlm: true` in `settings.json`.

When enabled:
- only `run_python` is exposed to inference contexts
- all regular tools stay registered internally and are callable by Python code

## Tool Stub Generation

`rlmPreambleBuild()` generates Python stubs from the current `ToolResolver.listTools()` output.
Each stub is rendered as:

```python
def tool_name(arg1: type, arg2: type) -> str:
    """Tool description"""
    ...
```

The preamble is embedded in the `run_python` tool description and regenerated from the
current tool set when context tools are built.

At execution time, `run_python` uses the **runtime** tool resolver from the current tool
execution context when available (for example app/subagent tool overrides). This keeps
Python tool stubs and dispatch aligned with the active sandboxed tool view.

## Execution Flow

`rlmExecute()` uses Monty's iterative `start()`/`resume()` loop:

1. Start Monty with `preamble + user code`
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

## Error Handling

- `MontySyntaxError`: returned as tool error with a "fix and retry" hint
- `MontyRuntimeError`: returned as tool error with traceback output
- Tool execution errors: resumed into Python as `ToolError`, so user code can catch them via
  `try/except ToolError`
