This is a minimal Python runtime with strict typing. No standard library modules are available (`json`, `os`, `re`, `datetime`, etc. do not exist). The `typing` module is available (`Any`, `TypedDict`). Use builtins, string methods, list/dict comprehensions, type annotations, and the tool functions listed below.
Call tool functions directly (no `await`). Use `try/except ToolError` for tool failures.
Many tools return typed dicts (see `TypedDict` signatures above). Access fields directly: `result["field"]`. Some tools return plain strings when no schema is defined.
Use `print()` for debug output. The value of the final expression is returned.
Call `skip()` to skip the current turn without producing output for the LLM. For cron and heartbeat tasks, this skips the scheduled invocation entirely. If `skip()` is not called, all Python outputs are provided to the LLM as context for the next turn.
Every single Python block runs in a SEPARATE throw away instance. In-memory variables do not persist across blocks. If you need results later, persist them to disk with `write_output(...)` and **always print the returned path** — it contains a timestamp prefix and is unique per call. Then read that path back in a later block.
When `read(...)` is called from Python execution, text is unbounded for the selected `offset`/`limit` range (no 50KB/2000-line truncation).
Use `read_json(...)` when you need parsed JSON objects/lists directly instead of raw text.

Prefer one script with multiple tool calls over separate invocations. Store results in variables and pass them between tools — do not manually construct or parse strings when a variable already holds the value. Independent tool calls can run sequentially in the same script; this is faster than multiple round-trips.
```python
# Good: batch tool calls, pass variables directly
items = list_items()
details = get_details(items["id"])
update_item(items["id"], notes=details["summary"])
```

```python
# Persist data you need across separate Python blocks.
# write_output returns the path (date-prefixed, unique) — always print it.
payload = {"items": list_items()}
result = write_output(name="step-1-results", content=str(payload))
print(result["path"])  # e.g. ~/outputs/20250615103045-step-1-results.md
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
result = write_output(name="search-results", content=str(payload))
print(result["path"])  # always print — path is date-prefixed and unique
```

```python
# Write structured output as JSON when needed.
# write_output returns the written path — always print it.
rows_json = '[{"id":"a1","status":"ok"}]'
result = write_output(name="rows", format="json", content=rows_json)
print(result["path"])  # e.g. ~/outputs/20250615103045-rows.json
```

Example scripts for common patterns are available in the bundled examples folder:
- Docker runtime: `{{examplesDockerDir}}`
- Non-Docker runtime: `{{examplesHostDir}}`
Use `read()` to view them.
