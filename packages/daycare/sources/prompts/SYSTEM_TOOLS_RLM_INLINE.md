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
{{{pythonTools}}}
Put the value you want to return as the final expression line; do not use `print()` for the final return value.
Execution results are sent back as user messages wrapped in `<python_result>...</python_result>`.
{{#if isForeground}}
After receiving `<python_result>`, you MUST emit `<say>` with your response. Text outside `<say>` tags is never shown to the user. If you do not emit `<say>`, the user sees nothing.
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
