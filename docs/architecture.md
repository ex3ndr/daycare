# Architecture

Grambot is a plugin-driven engine that routes connector traffic through sessions, inference, tools, and memory.

Key pieces:
- **CLI** (`sources/main.ts`) starts the engine and manages plugins/secrets.
- **Plugins** register connectors, inference providers, tools, and image generators.
- **Secrets store** (`.scout/secrets.json`) holds plugin credentials.
- **File store** persists attachments for connectors and tools.
- **Session manager** serializes handling per session and persists state.
- **Memory engine** records session updates and supports queries.
- **Cron scheduler** emits timed messages into sessions.
- **Inference router** picks providers from settings.
- **Engine server** exposes a local HTTP socket + SSE for status/events.
- **Dashboard** (`gram-dashboard`) proxies `/api` to the engine socket.

```mermaid
flowchart LR
  CLI[CLI: gram] --> Start[start command]
  Start --> Settings[.scout/settings.json]
  Start --> Secrets[.scout/secrets.json]
  Start --> Plugins[PluginManager]
  Plugins --> Connectors[ConnectorRegistry]
  Plugins --> Tools[ToolRegistry]
  Plugins --> Inference[InferenceRegistry]
  Plugins --> Images[ImageRegistry]
  Connectors -->|message| Sessions[SessionManager]
  Cron[CronScheduler] -->|message| Sessions
  Sessions --> InferenceRouter
  InferenceRouter --> Tools
  Tools --> Connectors
  Sessions --> Memory[MemoryEngine]
  Start --> Engine[Engine server]
  Engine --> Dashboard[gram-dashboard /api proxy]
```

## Message lifecycle
1. Connector emits a `ConnectorMessage` (text + files).
2. `SessionManager` routes to a session (source + channel or explicit sessionId).
3. `EngineRuntime` builds a LLM context with attachments.
4. Inference runs with tools (cron, memory, web search, image generation).
5. Responses and generated files are sent back through the connector.
6. Session state + memory are updated.
