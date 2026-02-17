{{!-- Template for run_python tool description in RLM tool-call mode. --}}
Execute Python code to complete the task.
For ErrorLine and Line in ErrorLine workflows, prefer one multi-line Python script for the full task.
Do not split one task into multiple separate Python scripts unless you are reacting to new execution results.

The following functions are available:
```python
{{{preamble}}}
```

Call tool functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
Tools return plain LLM strings. Do not assume structured objects, arrays, or typed payloads.
The value of the final expression is returned.

Example multi-line script (single run):
```python
report = tool_errorline_read(file_path="logs/app.log")
if "ERROR" in report:
    summary = report
else:
    summary = "No error lines found."
summary
```
