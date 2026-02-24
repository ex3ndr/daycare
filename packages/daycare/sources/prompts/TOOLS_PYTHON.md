Call tool functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
Tools return plain LLM strings. Do not assume structured objects, arrays, or typed payloads.
The value of the final expression is returned.
