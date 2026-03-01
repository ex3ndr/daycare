This is a minimal Python runtime with strict typing. No standard library modules are available (`json`, `os`, `re`, `datetime`, etc. do not exist). The `typing` module is available (`Any`, `TypedDict`). Use builtins, string methods, list/dict comprehensions, type annotations, and the tool functions listed below.
Call tool functions directly (no `await`). Use `try/except ToolError` for tool failures.
Many tools return typed dicts (see `TypedDict` signatures above). Access fields directly: `result["field"]`. Some tools return plain strings when no schema is defined.
Use `print()` for debug output. The value of the final expression is returned.
Call `skip()` to skip the current turn without producing output for the LLM. For scheduled task runs, this skips the invocation entirely. If `skip()` is not called, all Python outputs are provided to the LLM as context for the next turn.
Every single Python block runs in a SEPARATE throw away instance. In-memory variables do not persist across blocks. If you need results later, persist them to disk with `write_output(...)` and **always print the returned path** — it contains a timestamp prefix and is unique per call. Then read that path back in a later block.
When `read(...)` is called from Python execution, text is unbounded for the selected `offset`/`limit` range (no 50KB/2000-line truncation).
Use `read_json(...)` when you need parsed JSON objects/lists directly instead of raw text.
Use `json_parse(text=...)["value"]` and `json_stringify(value=..., pretty=True|False)["value"]` for in-memory JSON conversion when needed.
For shell commands via `exec(...)`, home paths should use `~` (or `$HOME`) in the command itself; `pwd` is the current
working directory, not the home directory.

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

Tool output shown to the model is truncated. Prefer `exec` + `write_output` for larger shell results:
```python
rg_result = exec(command="rg --line-number --no-heading 'TODO' .")
fd_result = exec(command="fd --hidden --glob '*.md' .")
ls_result = exec(command="ls -1apL .")
payload = {
    "rg": rg_result["summary"],
    "fd": fd_result["summary"],
    "ls": ls_result["summary"]
}
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

## Context Management

Avoid emitting large amounts of text from Python back into your own context window. When gathering information from multiple sources, **write intermediate results to files** and combine them in Python — only the final value is returned to you.

**Pattern: gather → combine → return.**
When researching a topic across multiple sources (web searches, pages, memory), persist each result to a file, then read them back and assemble a combined answer in Python. This keeps intermediate payloads out of your context.
```python
# Step 1: run multiple searches, persist each result
r1 = web_search(query="Python 3.13 new features")
p1 = write_output(name="search-1", content=str(r1))
print(p1["path"])

r2 = web_search(query="Python 3.13 performance improvements")
p2 = write_output(name="search-2", content=str(r2))
print(p2["path"])

r3 = web_fetch(url="https://docs.python.org/3.13/whatsnew/3.13.html")
p3 = write_output(name="whatsnew-page", content=str(r3))
print(p3["path"])
```

```python
# Step 2 (next block): read persisted files, combine into a single report
s1 = read(path="/home/outputs/20250615103045-search-1.md")
s2 = read(path="/home/outputs/20250615103046-search-2.md")
page = read(path="/home/outputs/20250615103047-whatsnew-page.md")

f"# Python 3.13 Research\n\n## Search: features\n{s1}\n\n## Search: performance\n{s2}\n\n## Official changelog\n{page}"
```

Key rules:
- Do **not** echo raw search/fetch results into your response and then re-process them — that wastes context on duplicate text.
- Use `read()` to pull file content back into Python. Use `read_json()` when you need parsed objects/lists.
- If you only need a subset, filter in Python before returning the final expression.

**Compressing large text:** When a fetched page or search result is too long to include verbatim, call `inference_summary(task=..., text=...)` to compress it. The summary model has a very large context window and can handle virtually unlimited input — do not hesitate to pass entire pages, long search results, or concatenated multi-file content to it.
```python
page = read(path="/home/outputs/20250615103047-whatsnew-page.md")
result = inference_summary(task="List the 5 most important new features with one-line descriptions", text=page)
result["summary"]
```

This delegates summarization to a secondary model so you receive a compact result instead of the full source. Use it liberally whenever raw data would bloat your context.

**Bypassing your own context:** You do not need to read results yourself before responding. When your task is to gather data and report back to a parent agent or user, pipe persisted files directly through `inference_summary` and return the summary as your final expression — the raw data never enters your context at all:
```python
# Summarize a previously written file and return directly — you never read the raw content
raw = read(path="/home/outputs/20250615103047-whatsnew-page.md")
result = inference_summary(task="Produce a concise research brief covering key findings", text=raw)
result["summary"]
```

This avoids context rot: instead of reading large results, reasoning over them, and paraphrasing, you let the summary model distill the data and forward a clean result straight to the caller. If you need to reason about the content yourself, you can of course read it — or read the summary instead of the raw data to keep your context lean.

Example scripts for common patterns are available in the bundled examples folder at `{{examplesDir}}`. Use `read()` to view them.
