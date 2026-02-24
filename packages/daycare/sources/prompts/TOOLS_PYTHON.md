This is a minimal Python runtime with strict typing. No standard library modules are available (`json`, `os`, `re`, `datetime`, etc. do not exist). The `typing` module is available (`Any`, `TypedDict`). Use builtins, string methods, list/dict comprehensions, type annotations, and the tool functions listed below.
Call tool functions directly (no `await`). Use `try/except ToolError` for tool failures.
Many tools return typed dicts (see `TypedDict` signatures above). Access fields directly: `result["field"]`. Some tools return plain strings when no schema is defined.
Use `print()` for debug output. The value of the final expression is returned.

Prefer one script with multiple tool calls over separate invocations. Store results in variables and pass them between tools — do not manually construct or parse strings when a variable already holds the value. Independent tool calls can run sequentially in the same script; this is faster than multiple round-trips.
```python
# Good: batch tool calls, pass variables directly
items = list_items()
details = get_details(items["id"])
update_item(items["id"], notes=details["summary"])
```

Loops with tool calls are supported — up to ~100 iterations is fine. The runtime cannot be interrupted mid-execution, so always use a bounded loop (`for item in items[:100]`), never an open-ended `while True`.
```python
nodes = memory_search(query="status")
for node in nodes["results"][:50]:
    data = memory_node_read(node["id"])
    print(data["content"])
```

Tool output shown to the model is truncated. Prefer filesystem helpers for large results:
```python
grep_results = grep(pattern="TODO", path=".", glob="*.ts", limit=200)
find_results = find(pattern="*.md", path=".", limit=200)
ls_results = ls(path=".", limit=200)
payload = {"grep": grep_results, "find": find_results, "ls": ls_results}
write_output(name="search-results", content=str(payload))  # Python repr format; json module unavailable.
"Results written to /home/outputs/search-results.md"
```
