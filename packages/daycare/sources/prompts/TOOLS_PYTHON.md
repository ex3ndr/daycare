This is a minimal Python runtime with strict typing. No standard library modules are available (`json`, `os`, `re`, `datetime`, etc. do not exist). Use only builtins, string methods, list/dict comprehensions, and the tool functions listed below.
Call tool functions directly (no `await`). Use `try/except ToolError` for tool failures.
Many tools return typed dicts (see `TypedDict` signatures above). Access fields directly: `result["field"]`. Some tools return plain strings when no schema is defined.
Use `print()` for debug output. The value of the final expression is returned.

Prefer one script with multiple tool calls over separate invocations. Store results in variables and pass them between tools — do not manually construct or parse strings when a variable already holds the value. Independent tool calls can run sequentially in the same script; this is faster than multiple round-trips.

Tool output shown to the model is truncated. For large results, write them to `/home/outputs/` instead:
```python
data = some_tool_with_large_output()
with open("/home/outputs/result.txt", "w") as f:
    f.write(str(data))
```
