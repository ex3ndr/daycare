# Inference runtime

Inference is provided by built-in providers. They register with the `InferenceRegistry`,
and the `InferenceRouter` selects them based on `.scout/settings.json`.

## Providers
Configured in settings (in priority order):
```json
{
  "providers": [
    { "id": "openai", "enabled": true, "model": "gpt-4o-mini" }
  ]
}
```

`gram add` stores providers in priority order; disabled providers are skipped.
`gram providers` moves the selected provider to the top of the priority list.

```mermaid
flowchart LR
  CLI[gram add] --> Auth[.scout/auth.json]
  CLI --> Settings[.scout/settings.json]
  Settings --> Inference[InferenceRouter]
  Auth --> Inference
```

## Tools
Tools are registered dynamically by plugins and core runtime:
- `add_cron` schedules a cron task.
- `memory_search` queries the memory plugin.
- `web_search` (Brave) performs web search.
- `generate_image` uses registered image providers and is only added when one is available.
- `set_reaction` sets connector reactions (Telegram).
- `read` reads a UTF-8 text file from the session workspace (paths must resolve inside the workspace; large files may be truncated).
- `write` writes UTF-8 text to a file in the session workspace, creating parent directories as needed (paths must resolve inside the workspace; supports append).
- `edit` applies sequential find/replace edits to a file in the session workspace (each edit must match at least once; paths must resolve inside the workspace).
- `exec` runs a shell command with the working directory locked to the session workspace (or a subdirectory within it) and returns stdout/stderr.

```mermaid
sequenceDiagram
  participant Model
  participant Engine
  participant Tool
  Model->>Engine: toolCall
  Engine->>Tool: execute
  Tool-->>Engine: toolResult (+ files)
  Engine-->>Model: toolResult
```

```mermaid
sequenceDiagram
  participant Engine
  participant Settings
  participant Auth
  participant Inference
  participant Tools
  Engine->>Settings: read providers
  Engine->>Auth: read credentials
  Engine->>Inference: ensure systemPrompt (Codex)
  Engine->>Inference: complete(context + tools)
  Inference-->>Tools: tool call(s)
  Tools-->>Inference: tool result(s)
```
