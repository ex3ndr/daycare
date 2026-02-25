# Tools: output format, python read mode, and message overflow

This change introduces three related behaviors:

- `write_output` now supports `format: "markdown" | "json"` (default `markdown`).
- `read` becomes unbounded when called from Python tool execution.
- `read_json` reads selected file text and parses it as JSON.
- `send_agent_message` spills oversized bodies (> 8000 chars) to `/home/outputs/*.md` and sends a file reference instead.

## Flow

```mermaid
flowchart TD
  A[run_python block] --> B[Tool call execution]
  B --> C{tool name}
  C -- read --> D[read tool]
  D --> E{pythonExecution?}
  E -- yes --> F[sandbox.read raw=true\nno 50KB/2000-line truncation]
  E -- no --> G[sandbox.read raw=false\ndefault truncation]

  C -- read_json --> Q[read_json tool]
  Q --> R[sandbox.read raw=true]
  R --> S[JSON.parse full file text]
  S --> T[return parsed object/list]

  C -- write_output --> H[write_output tool]
  H --> I{format}
  I -- markdown --> J[name.md collision-safe]
  I -- json --> K[name.json collision-safe]

  C -- send_agent_message --> L[send_agent_message tool]
  L --> M{text length > 8000?}
  M -- no --> N[send inline text]
  M -- yes --> O[write_output(name=agent-message-*, format=markdown)]
  O --> P[send reference text with /home/outputs path]
```

## Notes

- The overflow path reuses `write_output` implementation to keep output behavior consistent.
- Python isolation and persistence guidance in `TOOLS_PYTHON.md` now includes format usage, Python-mode `read` behavior, and `read_json`.
