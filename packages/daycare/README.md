# Daycare

Daycare is a local-first, plugin-driven multi-agent runtime.

It provides:

- persistent agents and message routing
- connector integrations (for example Telegram and WhatsApp)
- cron and heartbeat scheduling
- permission-gated tools and sandboxed shell/process execution
- pluggable inference providers, search/fetch tools, and memory/database plugins

## Package Scope

This package contains the core runtime and CLI for Daycare.

In this monorepo, source code lives in `packages/daycare/sources` and builds to `packages/daycare/dist`.

## Requirements

- Node.js 22+

## Install (npm)

```sh
npm install daycare
```

This repository currently develops Daycare in a monorepo, but this package README is scoped for standalone package consumption.

## CLI Commands

The Daycare CLI command surface:

- `daycare start`
- `daycare status`
- `daycare add`
- `daycare remove`
- `daycare providers`
- `daycare plugins load <pluginId> [instanceId]`
- `daycare plugins unload <instanceId>`
- `daycare auth set <id> <key> <value>`
- `daycare doctor`
- `daycare event <type> [payload]`

## Development (Monorepo)

From repository root:

```sh
yarn workspace daycare dev --help
yarn workspace daycare test
yarn workspace daycare typecheck
yarn workspace daycare build
```

Or use the root shortcut:

```sh
yarn dev --help
```

## Runtime Paths

By default, Daycare stores runtime state under `~/.daycare`, including:

- `settings.json`
- `auth.json`
- `daycare.sock`

You can override the root path with `DAYCARE_ROOT_DIR`.

## Configuration

At runtime, `settings.json` controls engine, providers, and plugins.
Credentials are stored in `auth.json`.

## License

MIT
