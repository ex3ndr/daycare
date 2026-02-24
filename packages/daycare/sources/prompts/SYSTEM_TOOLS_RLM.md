{{!-- Template for run_python tool description in RLM tool-call mode. --}}
Execute Python code to complete the task.
Prefer one multi-line Python script for the full task.
Do not split one task into multiple separate Python scripts unless you are reacting to new execution results.

The following functions are available:
```python
{{{preamble}}}
```

{{{pythonTools}}}

Example multi-line script (single run):
```python
report = "ERROR: timeout while processing"
if "ERROR" in report:
    summary = report
else:
    summary = "No error lines found."
summary
```
