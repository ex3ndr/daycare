<p align="center">
  <img src="logo.png" alt="Daycare" width="200" />
</p>

<h1 align="center">Daycare</h1>

<p align="center">
  Local-first, plugin-driven multi-agent runtime.
</p>

## What It Is

Daycare runs persistent agents behind connectors like Telegram and WhatsApp, with schedulers (cron + webhook), permissions, sandboxed shell/process tools, and pluggable providers/tools.

The core lives in `packages/daycare`. A monitoring UI lives in `packages/daycare-dashboard`.

## Repository Layout

- `packages/daycare` - CLI, engine, plugins, prompts, skills
- `packages/daycare-dashboard` - Next.js dashboard
- `doc` - concepts, providers, connectors, internals

## Requirements

- Node.js 22+
- Yarn 1.x (`yarn@1.22.22` in this repo)

## Quick Start

```sh
yarn install

# Interactive onboarding (pick provider/plugin)
yarn dev add

# Start engine
yarn dev start

# Check status
yarn dev status
```

`yarn dev` in this repo sets `DAYCARE_ROOT_DIR=~/.dev`, so local development state is written under `~/.dev`.

If you run the CLI directly from `packages/daycare` without `DAYCARE_ROOT_DIR`, default state lives under `~/.daycare`.

## CLI Commands

Use the dev CLI runner:

```sh
yarn dev --help
```

Common commands:

- `yarn dev start` - start engine
- `yarn dev status` - show engine status
- `yarn dev add` - add provider or plugin (interactive)
- `yarn dev remove` - remove provider or plugin (interactive)
- `yarn dev providers` - select default provider
- `yarn dev plugins load <pluginId> [instanceId]` - load plugin
- `yarn dev plugins unload <instanceId>` - unload plugin
- `yarn dev auth set <id> <key> <value>` - set auth credential
- `yarn dev doctor` - provider health checks
- `yarn dev event <type> [payload]` - send engine event via local socket
- `yarn dev add` -> `Plugin` -> `Dashboard` - enable bundled dashboard server

## Configuration And Data

The runtime uses:

- `settings.json` - engine/providers/plugins config
- `auth.json` - credentials
- `daycare.sock` - local engine socket

By default these live under:

- `~/.dev` when using this repo's root `yarn dev` script
- `~/.daycare` otherwise

See `doc/internals/config.md` and `doc/internals/auth.md` for exact schema/behavior.

## Development

```sh
yarn build        # build daycare package
yarn lint         # biome check (format + lint)
yarn lint:fix     # biome check --write
yarn test         # run workspace tests
yarn typecheck    # typecheck workspaces
yarn release      # release daycare-cli (no package-lock, test/build, tag, publish, rollback)
yarn dashboard    # run dashboard on :7331
```

You can also run workspace-local scripts:

```sh
yarn workspace daycare dev --help
yarn workspace daycare test
yarn workspace daycare typecheck
```

## Providers, Plugins, Tools

Daycare ships with built-in provider integrations plus plugins for connectors, search/fetch, memory/database, shell/process tooling, and more.

Use interactive onboarding to see current options in your checkout:

```sh
yarn dev add
```

Reference docs:

- `doc/providers/README.md`
- `doc/concepts/networking.md`
- `doc/concepts/sandboxes.md`
- `doc/concepts/agents.md`

## Documentation

- `doc/README.md` - docs index
- `doc/concepts` - architecture and runtime behavior
- `doc/providers` - provider setup
- `doc/connectors` - connector setup
- `doc/internals` - implementation notes

## License

MIT
