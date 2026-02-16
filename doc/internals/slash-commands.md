# Slash Commands

## Overview
Daycare now supports plugin-registered slash commands via `PluginRegistrar.registerCommand()`.

Slash commands are user-facing connector features and are not exposed as model tools.

## Types
- `SlashCommandEntry`: `{ command: string; description: string }`
- `PluginCommandDefinition`: `SlashCommandEntry & { handler: CommandHandler }`

## Registration API
Plugins register and unregister commands through `PluginRegistrar`:
- `registerCommand(definition)`
- `unregisterCommand(name)`

The plugin registrar tracks command registrations and removes them during `unregisterAll()`.

## Runtime flow
```mermaid
flowchart LR
  Plugin[Plugin load()] --> Registrar[PluginRegistrar.registerCommand]
  Registrar --> Registry[CommandRegistry]
  Registry --> ConnectorRegistry[ConnectorRegistry.onChange]
  ConnectorRegistry --> Connector[Connector.updateCommands]
  User[User /command] --> Connector
  Connector --> Engine[Engine onCommand]
  Engine --> Lookup[CommandRegistry.get]
  Lookup --> Handler[Plugin command handler]
```

## Lifecycle hooks
`PluginInstance` also supports optional startup lifecycle hooks:
- `preStart()` runs after plugin reload + core tool registration, before engine systems start.
- `postStart()` runs after engine systems are started.

These hooks are invoked via:
- `PluginManager.preStartAll()`
- `PluginManager.postStartAll()`
