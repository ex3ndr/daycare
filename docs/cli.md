# CLI

The CLI is implemented with Commander in `sources/main.ts`. It always initializes logging first.

## Commands
- `start` - launches the engine (default settings `.scout/settings.json`).
- `status` - prints engine status if the socket is live.
- `plugins load <id>` - loads a plugin (updates settings if engine is down).
- `plugins unload <id>` - unloads a plugin.
- `secrets set <plugin> <key> <value>` - stores a plugin secret.

## Development
- `yarn dev` runs the CLI directly via `tsx`.

```mermaid
flowchart TD
  main[main.ts] --> start[start]
  main --> status[status]
  main --> plugins[plugins]
  main --> secrets[secrets]
```

## start command flow
```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Settings
  participant Secrets
  participant Plugins
  participant Engine
  User->>CLI: gram start
  CLI->>Settings: read .scout/settings.json
  CLI->>Secrets: read .scout/secrets.json
  CLI->>Plugins: load enabled plugins
  CLI->>Engine: start local socket + SSE
```
