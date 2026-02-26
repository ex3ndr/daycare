# Replace `node:sqlite` With Drizzle ORM (Engine-Owned DB Instance)

## End Result Summary
- When this work is done, Daycare runtime storage uses Drizzle ORM end-to-end and no code imports `node:sqlite`.
- There is one complete schema definition file at `packages/daycare/sources/schema.ts` containing all tables, indexes, and constraints currently produced by migrations.
- DB open/migrate/close operations are centralized in `storage/` as `databaseOpen`, `databaseMigrate`, and `databaseClose`.
- The engine creates one DB instance during construction and passes it downstream through repositories/facades.
- Validation is explicit:
  - `rg -n "node:sqlite|DatabaseSync" packages/daycare/sources` returns no matches.
  - existing storage tests pass against the Drizzle-backed implementation.
  - startup/upgrade flows still succeed with existing DB files.

## Overview
- Migrate the storage layer from direct SQLite driver usage to Drizzle ORM.
- Keep SQLite file persistence and current data model semantics.
- Enforce a single engine-owned DB instance per runtime, reused directly through composition.

## Context (from discovery)
- Current DB bootstrap:
  - `packages/daycare/sources/commands/start.ts` reads config, then builds `Engine`.
  - `packages/daycare/sources/engine/engine.ts` currently calls `Storage.open(this.config.current.dbPath)`.
- Current SQLite coupling:
  - `packages/daycare/sources/storage/databaseOpen.ts` imports `node:sqlite` and configures pragmas.
  - Most repositories receive a `StorageDatabase` and execute SQL via `prepare/run/get/all`.
  - Many tests instantiate `Storage.open(":memory:")` or `databaseOpen(":memory:")`.
- Current fallback DB opens (must be removed):
  - `packages/daycare/sources/engine/channels/channels.ts`
  - `packages/daycare/sources/engine/signals/signals.ts`
  - `packages/daycare/sources/engine/signals/delayedSignals.ts`
  - `packages/daycare/sources/engine/expose/exposes.ts`
  - `packages/daycare/sources/engine/processes/processes.ts`
- Final schema footprint (from running current migrations) includes:
  - Tables: `_migrations`, `users`, `user_connector_keys`, `agents`, `sessions`, `session_history`, `inbox`, `tasks`, `tasks_cron`, `tasks_heartbeat`, `signals_events`, `signals_subscriptions`, `signals_delayed`, `channels`, `channel_members`, `channel_messages`, `expose_endpoints`, `processes`, `connections`, `system_prompts`, `token_stats_hourly`.
  - Triggers: nametag required triggers on `users`.
  - Multiple unique/secondary indexes across all domains.

## Approaches Considered
**Option A: Pass Drizzle DB through dependency injection everywhere (recommended, user-aligned)**
- How it works: constructor injection of DB/repositories from startup root.
- Pros: explicit ownership; avoids global mutable state; simpler lifecycle control.
- Cons: constructor churn in modules that previously self-opened storage.

**Option B: Hybrid adapter (`Storage` wraps Drizzle + legacy SQL shim)**
- How it works: keep old repository interface and proxy calls through compatibility helpers.
- Pros: less immediate code churn.
- Cons: prolongs migration, keeps dual mental model, conflicts with “replace completely”.

Decision: proceed with **Option A**.

## Development Approach
- **Testing approach**: regular (code first, then tests for each task before moving on).
- Make small, focused commits/tasks.
- Keep compatibility for existing DB files by preserving schema shape and migration behavior semantics.
- Do not introduce backward-compatibility shims for internal APIs beyond transition steps required to keep tests green.
- **CRITICAL: each task includes tests and test run before next task.**

## Testing Strategy
- Unit tests for:
  - global DB init/get lifecycle
  - repository CRUD/query behavior parity
  - startup ordering (DB initialized before engine wiring)
- Integration tests for:
  - startup with file-backed DB path
  - migrations/schema application on empty DB
  - operations that depend on transactions (`createAgentWithSession`, unique-key races)
- Regression checks:
  - no `node:sqlite` imports remain
  - lints/typecheck pass

## Progress Tracking
- Mark completed items with `[x]` immediately.
- Add newly discovered migration tasks with `➕`.
- Track blockers with `⚠️`.
- Keep this file updated if scope changes.

## Architecture
```mermaid
flowchart TD
    A[startCommand] --> B[configLoad(settingsPath)]
    B --> C[new Engine({ config, eventBus })]
    C --> D[databaseOpen(config.dbPath)]
    D --> E[databaseMigrate(db)]
    E --> F[Storage.fromDatabase(db)]
    F --> G[Repositories receive injected db-backed storage]
    G --> H[Signals/Channels/Exposes/Processes use injected repositories only]
```

## Implementation Steps

### Task 1: Add Drizzle dependencies and DB operation helpers
- [ ] add runtime deps (`drizzle-orm`, SQLite driver package chosen for non-`node:sqlite` runtime, e.g. `better-sqlite3`) and dev deps (`drizzle-kit` if migration generation is used)
- [ ] add `storage/databaseOpen.ts`, `storage/databaseMigrate.ts`, and `storage/databaseClose.ts`
- [ ] add tests for open/migrate/close behavior
- [ ] run test command(s) for touched scope

### Task 2: Define full schema in one file
- [ ] create `packages/daycare/sources/schema.ts` with all tables/indexes/constraints/triggers-equivalent constraints
- [ ] include typed exports for DB shape (`schema`, `DaycareDb`) for repository usage
- [ ] verify schema parity against current migration result (table/index list)
- [ ] add schema integrity tests (presence of critical unique/composite keys)
- [ ] run test command(s) for touched scope

### Task 3: Initialize DB in engine composition root
- [ ] update `packages/daycare/sources/engine/engine.ts` to call `databaseOpen` + `databaseMigrate`
- [ ] ensure storage is created with `Storage.fromDatabase(db)` and passed downstream
- [ ] wire runtime shutdown with `databaseClose(storage.db)`
- [ ] add/adjust tests proving engine-owned lifecycle
- [ ] run test command(s) for touched scope

### Task 4: Migrate migration/bootstrap path to Drizzle
- [ ] replace `databaseOpen` + raw migration runner usage with Drizzle migration/bootstrap flow
- [ ] keep current DB upgrade semantics for existing databases
- [ ] update `storageUpgrade.ts`/`upgrade.ts` to use `databaseOpen` + `databaseMigrate` + `databaseClose`
- [ ] add migration tests for empty DB and existing DB paths
- [ ] run test command(s) for touched scope

### Task 5: Convert repositories to Drizzle queries
- [ ] migrate repository implementations under `packages/daycare/sources/storage/*Repository.ts` to Drizzle query API / `sql` helpers
- [ ] replace raw transaction blocks with Drizzle transactions
- [ ] remove `StorageDatabase` constructor coupling and `SQLInputValue` usage
- [ ] add/update repository tests to ensure behavioral parity (success + error/constraint scenarios)
- [ ] run storage test suite before next task

### Task 6: Refactor `Storage` facade and resolver paths
- [ ] update `packages/daycare/sources/storage/storage.ts` to stop owning DB open/close responsibilities
- [ ] keep `storageResolve.ts` for non-engine call paths; remove global DB dependencies
- [ ] delete `databaseOpen.ts` and types that exist only for `node:sqlite`
- [ ] add/update tests for storage facade behavior
- [ ] run test command(s) for touched scope

### Task 7: Remove internal fallback DB opens in engine modules
- [ ] remove `Storage.open(...)` fallback branches from channels/signals/delayed-signals/exposes/processes facades
- [ ] require explicit repository injection from engine composition root
- [ ] update `engine.ts` composition to pass repository dependencies derived from engine-owned db-backed storage
- [ ] add/update module tests for constructor behavior and runtime operations
- [ ] run engine-related test command(s)

### Task 8: Update agent ops/utilities that depend on config-to-storage resolution
- [ ] refactor ops that currently call `storageResolve(config)` to use injected storage/repositories where available
- [ ] keep `ctx`-scoped repository contracts intact
- [ ] update affected tests in `engine/agents/ops/*` and related tool tests
- [ ] run agent/tool test command(s)
- [ ] run test command(s) for touched scope

### Task 9: Clean up obsolete migration artifacts and raw SQL helpers
- [ ] remove unused raw SQLite migration utilities/types once Drizzle path is stable
- [ ] ensure no dead imports/re-exports remain in storage module graph
- [ ] add a guard test/check for forbidden imports (`node:sqlite`, `DatabaseSync`)
- [ ] run lint + typecheck
- [ ] run full test suite

### Task 10: Verify acceptance criteria
- [ ] confirm engine constructs and migrates DB once per runtime
- [ ] confirm engine-owned DB instance is used throughout engine runtime
- [ ] confirm `rg -n "node:sqlite|DatabaseSync" packages/daycare/sources` has no matches
- [ ] run full tests and verify green
- [ ] run lint/typecheck and verify green

### Task 11: Update documentation
- [ ] add migration notes and new DB architecture doc under `doc/` with a mermaid diagram
- [ ] update any storage docs referencing `node:sqlite`
- [ ] ensure docs describe global init location and repository access pattern

## Technical Details
- DB global module responsibilities:
  - expose typed DB open/migrate/close helpers in `storage/`
  - keep lifecycle ownership in engine composition
- Startup ordering contract:
  - `configLoad` -> `new Engine(...)` -> `databaseOpen/migrate` inside engine constructor -> `runtime.start()`
- Transaction-critical flows to preserve:
  - `Storage.createAgentWithSession`
  - connector key race handling / unique constraint retries
  - scoped task ID constraints (`tasks` + `tasks_cron`/`tasks_heartbeat`)
- Compatibility target:
  - existing file DBs should boot without manual data migration.

## Post-Completion
**Manual verification**
- Start Daycare against existing real workspace DB and verify:
  - owner/user resolution
  - agent/session lifecycle
  - cron/heartbeat execution
  - signals/channels/expose/processes persistence
- Run `daycare upgrade` and verify no unexpected schema drift.

**External follow-ups**
- If native SQLite driver is introduced (e.g. `better-sqlite3`), confirm CI/build environments have required toolchain/runtime support.
