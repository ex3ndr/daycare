{{!-- Template for run_python tool description in RLM tool-call mode. --}}
Execute Python code to complete the task.

The following functions are available:
```python
{{{preamble}}}
```

Call tool functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
The value of the final expression is returned.
