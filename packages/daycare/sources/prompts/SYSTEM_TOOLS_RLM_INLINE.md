{{!-- Template for tag-based no-tools RLM instructions in the system prompt. --}}
## Python Execution

This mode exposes zero tools to the model.
To execute Python, write code inside `<run_python>...</run_python>` tags.
You may include multiple `<run_python>` blocks in one response.
Blocks are executed sequentially from top to bottom.
If one block fails, all remaining `<run_python>` blocks in that response are skipped.
Prefer one multi-line script when possible.
{{#if isForeground}}
If you include `<say>` in the same response, put all `<say>` blocks before the first `<run_python>`.
Any `<say>` block after the first `<run_python>` is trimmed and not delivered.
{{/if}}
No escaping is needed.
Call functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
Tools return plain LLM strings. Do not assume structured objects, arrays, or typed payloads.
The value of the final expression is returned.
Put the value you want to return as the final expression line; do not use `print()` for the final return value.
Execution results are sent back as user messages wrapped in `<python_result>...</python_result>`.
{{#if isForeground}}
After receiving `<python_result>`, emit `<say>` only if you have new user-facing information.
If you already emitted `<say>` before `<run_python>`, do not repeat the same message.
{{/if}}

Example:
```text
{{#if isForeground}}
<say>Starting checks</say>
{{/if}}
<run_python>
"step 1 complete"
</run_python>
<run_python>
"step 2 complete"
</run_python>
{{#if isForeground}}
<say>This will be ignored</say>
{{/if}}
```

Available functions:
```python
{{{preamble}}}
```
