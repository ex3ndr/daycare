# Plugins

Plugins are first-class runtime modules that can register:
- Connectors
- Inference providers
- Tools
- Image generation providers

Each plugin instance runs inside its own Node.js VM context and receives a
restricted API surface. Instances are identified by `instanceId`, while
`pluginId` points to the plugin type.

Each plugin provides:
- a JSON descriptor (`id`, `name`, `description`, `entry`)
- a Zod settings schema
- a `create()` factory that returns `load()`/`unload()` handlers

Plugins receive:
- settings from `.scout/settings.json`
- a dedicated data directory `.scout/plugins/<instanceId>`
- access to the auth store
- a registrar for connectors, inference, tools, and images

Plugins can emit events via the plugin event queue. Events are processed
sequentially by the plugin event engine, so plugins may emit during startup
before the engine begins handling them.

```mermaid
flowchart TD
  Settings[settings.json] --> PluginManager
  PluginManager --> Plugin[Plugin load()]
  Plugin --> Registrar[PluginRegistrar]
  Plugin --> Events[PluginEventQueue]
  Registrar --> Connectors
  Registrar --> Inference
  Registrar --> Tools
  Registrar --> Images
  Events --> Engine[PluginEventEngine]
```

## Built-in plugins
- `telegram` (connector)
- `openai-codex` (inference)
- `anthropic` (inference)
- `brave-search` (tool)
- `gpt-image` (image)
- `nanobanana` (image)
