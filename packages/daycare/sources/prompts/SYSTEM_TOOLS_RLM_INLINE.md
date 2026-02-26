{{!-- Template for tag-based no-tools RLM instructions in the system prompt. --}}
## Python Execution

This mode exposes zero tools to the model.
To execute Python, write code inside `<run_python>...</run_python>` tags.
You may include multiple `<run_python>` blocks in one response.
Blocks are executed sequentially from top to bottom.
If one block fails, all remaining `<run_python>` blocks in that response are skipped.
Prefer one multi-line script when possible.
{{#if isForeground}}
After receiving `<python_result>`, respond to the user with plain text.
{{/if}}
No escaping is needed.
{{{pythonTools}}}
Put the value you want to return as the final expression line; do not use `print()` for the final return value.
Execution results are sent back as user messages wrapped in `<python_result>...</python_result>`.

Example:
```text
<run_python>
"step 1 complete"
</run_python>
<run_python>
"step 2 complete"
</run_python>
```

Available functions:
```python
{{{preamble}}}
```
