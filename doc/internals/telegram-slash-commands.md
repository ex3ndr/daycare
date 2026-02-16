# Telegram Slash Command Registration

Telegram slash commands are pushed dynamically from the runtime command registry.

## Command sources
- Core commands: `/reset`, `/context`, `/compaction`, `/abort`
- Plugin commands: registered through `PluginRegistrar.registerCommand()`
- Example plugin commands: Upgrade plugin registers `/upgrade` and `/restart`

## Sync behavior
- `ConnectorRegistry` merges core + plugin command entries.
- Connectors implementing `updateCommands()` receive updates.
- `TelegramConnector.updateCommands()` debounces `setMyCommands()` calls by 1 second.
- Telegram plugin starts command sync from `postStart()` so initial registration happens after all startup plugin command registrations.

## Runtime flow
```mermaid
flowchart TD
  A[Plugin load/registerCommand] --> B[CommandRegistry]
  B --> C[ConnectorRegistry onChange]
  C --> D[TelegramConnector.updateCommands]
  D --> E[1s debounce]
  E --> F[bot.setMyCommands]
```

## Startup flow
```mermaid
flowchart TD
  A[Engine.start]
  A --> B[pluginManager.reload]
  B --> C[Telegram connector registered]
  C --> D[ConnectorRegistry sends commands]
  D --> E[Telegram caches pending command list]
  E --> F[pluginManager.postStartAll]
  F --> G[Telegram commandSyncStart]
  G --> H[Debounced setMyCommands]
```
