<p align="center">
  <img src="logo.png" alt="Daycare" width="200" />
</p>

<h1 align="center">Daycare</h1>

<p align="center">
  A minimal, composable AI agent framework with plugin-driven architecture.
</p>

## Features

- **Plugin system** - Connectors, inference providers, tools, and image generators as plugins
- **Agent management** - Per-channel message sequencing with persistent state
- **Memory plugin** - Searchable conversation history across agents
- **Cron scheduler** - Timed message dispatch and scheduled actions
- **Multi-provider inference** - Anthropic Claude, OpenAI, and more
- **Dashboard** - React SPA for monitoring and control

## Architecture

```mermaid
flowchart LR
  CLI[daycare CLI] --> Engine[Engine]
  Engine --> Plugins[Plugin Manager]
  Plugins --> Connectors[Connectors]
  Plugins --> Inference[Inference Providers]
  Plugins --> Tools[Tool Resolver]
  Connectors -->|message| Agents[Agent System]
  Cron[Cron Scheduler] -->|message| Agents
  Agents --> InferenceRouter[Inference Router]
  InferenceRouter --> Tools
  Agents --> Memory[Memory Plugin]
  Engine --> Socket[HTTP Socket API]
  Socket --> Dashboard[daycare-dashboard]
```

## Quick Start

```sh
# Install dependencies
yarn install

# Build the project
yarn build

# Start the engine
yarn daycare start
```

## Configuration

Daycare uses two configuration files in `.daycare/`:

**settings.json** - Engine and plugin configuration
```json
{
  "engine": { "socketPath": ".daycare/daycare.sock", "dataDir": ".daycare" },
  "plugins": [
    { "instanceId": "telegram", "pluginId": "telegram", "enabled": true },
    { "instanceId": "anthropic", "pluginId": "anthropic", "enabled": true },
    { "instanceId": "memory", "pluginId": "memory", "enabled": true }
  ],
  "inference": {
    "providers": [{ "id": "anthropic", "model": "claude-sonnet-4-20250514" }]
  }
}
```

**auth.json** - API keys and tokens
```json
{
  "telegram": { "type": "token", "token": "..." },
  "openai": { "type": "apiKey", "apiKey": "..." }
}
```

## Plugins

| Plugin | Type | Description |
|--------|------|-------------|
| telegram | Connector | Telegram bot with long polling |
| openai | Inference | GPT models via OpenAI API |
| brave-search | Tool | Web search integration |
| gpt-image | Image | OpenAI image generation |
| nanobanana | Image | Alternative image provider |
| memory | Tool | Conversation memory and search |

## Tools

The AI agent has access to these tools:

- `add_cron` - Schedule recurring tasks
- `cron_read_task` - Read cron task description + prompt
- `cron_read_memory` - Read cron task memory
- `cron_write_memory` - Update cron task memory
- `cron_delete_task` - Delete a cron task
- `memory_search` - Query conversation history (memory plugin)
- `web_search` - Search the web (Brave)
- `generate_image` - Create images
- `set_reaction` - React to messages

## CLI Commands

```sh
daycare start                    # Launch the engine
daycare status                   # Check engine status
daycare add                      # Add a provider or plugin
daycare plugins load <id>        # Load a plugin
daycare plugins unload <id>      # Unload a plugin
daycare auth set <id> <key> <value>         # Store a credential
```

## Development

```sh
yarn install      # Install dependencies
yarn build        # Compile TypeScript
yarn test         # Run tests
yarn typecheck    # Type check without emit
yarn dev          # Run with tsx (no build)
```

## Workspace

- `packages/daycare` - Core engine, plugins, and tools
- `packages/daycare-dashboard` - React dashboard + API proxy

## Documentation

See [docs/](./docs/) for detailed documentation:

- [Architecture](./docs/architecture.md) - System overview
- [Plugins](./docs/plugins.md) - Plugin system
- [Agents](./docs/agents.md) - Agent management
- [Memory](./docs/memory.md) - Memory plugin
- [Cron](./docs/cron.md) - Scheduled tasks
- [Config](./docs/config.md) - Configuration reference
- [CLI](./docs/cli.md) - Command reference

## License

MIT
