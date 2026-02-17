{{!-- Template for tag-based no-tools RLM instructions in the system prompt. --}}
## Python Execution

This mode exposes zero tools to the model.
To execute Python, write code inside `<run_python>...</run_python>` tags.
Emit at most one Python block per assistant response.
The system executes everything between the first `<run_python>` and last `</run_python>`.
If you include `<say>` in the same response, all `<say>` blocks must come before `<run_python>`.
Do not place `<say>` blocks after `<run_python>` in the same response.
`<say>` blocks before `<run_python>` are delivered immediately. `<say>` blocks after `</run_python>` are delivered only if execution succeeds.
No escaping is needed.
Call functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
The value of the final expression is returned.
Put the value you want to return as the final expression line; do not use `print()` for the final return value.
Execution results are sent back as user messages wrapped in `<python_result>...</python_result>`.
After receiving `<python_result>`, emit `<say>` only if you have new user-facing information.
If you already emitted `<say>` before `<run_python>`, do not repeat the same message.

Available functions:
```python
{{{preamble}}}
```
