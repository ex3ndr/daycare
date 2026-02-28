# RLM JSON Runtime Operations

Added two runtime-only RLM helper operations for JSON conversion without Python stdlib modules:

- `json_parse(text=...)["value"]`
- `json_stringify(value=..., pretty=True|False)["value"]`

These helpers are synthetic runtime operations. They are exposed in generated Monty preambles and executed directly in
RLM dispatch (not via `ToolResolver.execute`).

```mermaid
flowchart TD
    A[Python code in run_python] --> B[Monty preamble stubs]
    B --> C{Calls runtime helper?}
    C -->|json_parse/json_stringify| D[rlmStepToolCall runtime dispatch]
    D --> E[JSON.parse / JSON.stringify]
    E --> F[resumeOptions.returnValue]
    F --> G[Monty resume]
    C -->|other tools| H[ToolResolver.execute]
```
