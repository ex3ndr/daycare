{{!-- Template for run_python tool-calling instructions in the system prompt. --}}
## Python Execution

This mode exposes one native tool to the model: `run_python`.
To execute Python, call `run_python` with a string argument `code`.
You may include multiple `run_python` tool calls in one response.
Calls are executed sequentially from top to bottom.
If one call fails, all remaining `run_python` calls in that response are skipped.
Prefer one multi-line script when possible.
{{#if isForeground}}
When `say(...)` is available in the function list, prefer it for user-visible replies.
After receiving a `run_python` tool result, respond to the user with plain text.
{{/if}}
No escaping is needed.
{{{pythonTools}}}
Put the value you want to return as the final expression line; do not use `print()` for the final return value.
Execution results are sent back as `run_python` tool results.

Example:
```text
toolCall(name="run_python", arguments={"code": "\"step 1 complete\""})
toolCall(name="run_python", arguments={"code": "\"step 2 complete\""})
```

Available functions:
```python
{{{preamble}}}
```
