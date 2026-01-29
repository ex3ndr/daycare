# Inference runtime

Scout ships an inference helper for Codex and Claude Code via `@mariozechner/pi-ai`.

## Exports
- `connectCodex({ model, token?, authPath? })`
- `connectClaudeCode({ model, token?, authPath? })`

Each returns an `InferenceClient` with:
- `complete(context, options?)`
- `stream(context, options?)`

```mermaid
sequenceDiagram
  participant Caller
  participant Auth
  participant PiAI
  Caller->>Auth: read auth.json (if token missing)
  Auth-->>Caller: token
  Caller->>PiAI: getModel(provider, model)
  Caller->>PiAI: complete/stream(context)
```
