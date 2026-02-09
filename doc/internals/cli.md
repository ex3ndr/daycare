# CLI

The CLI is implemented with Commander in `sources/main.ts`. It always initializes logging first.

## Commands
- `start` - launches the engine (default settings `.daycare/settings.json`).
- `status` - prints engine status if the socket is live.
- `add` - interactive setup for a provider or plugin.
- `plugins load <pluginId> [instanceId]` - loads a plugin instance (updates settings if engine is down).
- `plugins unload <instanceId>` - unloads a plugin instance.
- `auth set <id> <key> <value>` - stores an auth credential.
- `doctor` - runs basic inference checks for configured providers.
- `event <type> [payload]` - generates a custom signal with optional JSON payload over the local socket.

## Development
- `yarn dev` runs the CLI directly via `tsx`.

```mermaid
flowchart TD
  main[main.ts] --> start[start]
  main --> status[status]
  main --> add[add]
  main --> plugins[plugins]
  main --> auth[auth]
  main --> doctor[doctor]
  main --> event[event]
```

## start command flow
```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Settings
  participant Auth
  participant Plugins
  participant Engine
  User->>CLI: daycare start
  CLI->>Settings: read .daycare/settings.json
  CLI->>Auth: read .daycare/auth.json
  CLI->>Plugins: load enabled plugins
  CLI->>Engine: start local socket + SSE
```

## event command flow
```mermaid
sequenceDiagram
  participant User
  participant CLI
  participant Socket
  participant Signals
  participant EventBus
  User->>CLI: daycare event custom.type {"ok":true}
  CLI->>Socket: POST /v1/engine/signals/generate
  Socket->>Signals: generate(type, source=process:daycare-cli, data)
  Signals->>EventBus: emit(signal.generated, signal)
  Socket-->>CLI: { ok: true }
```
