# Replace Raw SQL with Drizzle Typed Queries

## Overview
Migrate all 17 repository files from raw SQL (`db.prepare("SELECT ...")`) to Drizzle's typed query builder. The Drizzle schema (`schema.ts`) already defines all 21 tables with complete type information, and the `schemaDrizzle()` factory exists but is never used. This migration brings full type safety to all database queries while keeping the existing write-through caching and AsyncLock patterns intact.

**End result:**
- All repositories use `DaycareDb` (Drizzle typed instance) instead of `StorageDatabase`
- ~140+ raw SQL queries replaced with Drizzle query builder calls
- `DatabaseXxxRow` types removed (Drizzle infers select types from schema)
- `XxxDbRecord` app-level types preserved (they carry JSON-parsed rich types)
- `StorageDatabase` retained only for infrastructure (migration runner, schema validator)
- `Storage` facade updated to use Drizzle transactions instead of raw `BEGIN`/`COMMIT`

## Context
- Schema: `sources/schema.ts` — 21 Drizzle table definitions, `DaycareDb` type, `schemaDrizzle()` factory
- Repositories: 17 files in `sources/storage/` using `StorageDatabase.prepare()` for raw SQL
- Wiring: `Storage` facade in `storage.ts` passes `StorageDatabase` to all repositories
- Types: `databaseTypes.ts` has both `DatabaseXxxRow` (raw column types) and `XxxDbRecord` (app types)
- Infrastructure: `migrationRun.ts`, `databaseSchemaMatches.ts`, `storageUpgrade.ts` — keep raw SQL
- Tests: `storageOpenTest.ts` creates in-memory PGlite, runs migrations, returns `Storage`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Keep caching + AsyncLock patterns unchanged — only replace SQL with Drizzle
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run `yarn typecheck` and `yarn test` after each change

## Drizzle Query Mapping Reference

| Raw SQL pattern | Drizzle equivalent |
|---|---|
| `db.prepare("SELECT * FROM t WHERE id = ?").get(id)` | `db.select().from(t).where(eq(t.id, id)).limit(1).then(r => r[0])` |
| `db.prepare("SELECT * FROM t ORDER BY x").all()` | `db.select().from(t).orderBy(asc(t.x))` |
| `db.prepare("INSERT INTO t (...) VALUES (...)").run(...)` | `db.insert(t).values({...})` |
| `db.prepare("UPDATE t SET ... WHERE id = ?").run(...)` | `db.update(t).set({...}).where(eq(t.id, id))` |
| `db.prepare("DELETE FROM t WHERE id = ?").run(id)` | `db.delete(t).where(eq(t.id, id))` |
| `INSERT ... ON CONFLICT DO UPDATE` | `db.insert(t).values({...}).onConflictDoUpdate({target: t.id, set: {...}})` |
| `db.exec("BEGIN")` ... `db.exec("COMMIT")` | `db.transaction(async (tx) => {...})` |
| `INSERT ... RETURNING id` | `db.insert(t).values({...}).returning({id: t.id})` |

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Wire up DaycareDb alongside StorageDatabase
- [ ] Modify `databaseOpen.ts`: expose PGlite client alongside `StorageDatabase` (add `databaseOpenWithClient()` that returns `{ db: StorageDatabase, client: PGlite }`)
- [ ] Modify `databaseOpenTest.ts`: return both `StorageDatabase` and PGlite client
- [ ] Modify `storageOpenTest.ts`: create `DaycareDb` via `schemaDrizzle(client)` and pass to `Storage`
- [ ] Modify `Storage` class: accept `DaycareDb` as second constructor param, pass to repositories
- [ ] Modify `Storage.fromDatabase()`: accept `DaycareDb`, update all call sites
- [ ] Verify `yarn typecheck` passes
- [ ] Verify `yarn test` passes (no behavioral changes yet)

### Task 2: Migrate inboxRepository (4 queries, simplest)
- [ ] Change constructor to accept `DaycareDb` instead of `StorageDatabase`
- [ ] Replace SELECT query with `db.select().from(inboxTable).where(...).orderBy(...)`
- [ ] Replace INSERT with `db.insert(inboxTable).values({...})`
- [ ] Replace DELETE queries with `db.delete(inboxTable).where(...)`
- [ ] Remove `DatabaseInboxRow` import, use Drizzle-inferred types
- [ ] Update/write tests for inbox CRUD operations
- [ ] Run `yarn typecheck && yarn test`

### Task 3: Migrate channelMessagesRepository (2 queries)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace INSERT with `db.insert(channelMessagesTable).values({...})`
- [ ] Replace SELECT with `db.select().from(channelMessagesTable).where(...).orderBy(...)`
- [ ] Remove `DatabaseChannelMessageRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 4: Migrate sessionsRepository (7 queries, includes CAS update)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace SELECT/INSERT/UPDATE queries with Drizzle equivalents
- [ ] Handle CAS update: `db.update().set(...).where(and(eq(...), eq(...)))` for compare-and-swap
- [ ] Replace `RETURNING id` pattern with `.returning()`
- [ ] Remove `DatabaseSessionRow` usage
- [ ] Update/write tests including CAS behavior
- [ ] Run `yarn typecheck && yarn test`

### Task 5: Migrate historyRepository (5 queries, includes JOIN)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace JOIN query with `db.select().from(sessionHistoryTable).innerJoin(sessionsTable, ...)`
- [ ] Replace MAX aggregation with `db.select({ max: max(sessionHistoryTable.id) })`
- [ ] Replace INSERT/SELECT with Drizzle equivalents
- [ ] Remove `DatabaseSessionHistoryRow` usage
- [ ] Update/write tests including JOIN behavior
- [ ] Run `yarn typecheck && yarn test`

### Task 6: Migrate signalSubscriptionsRepository (5 queries, composite unique UPSERT)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace UPSERT with `.onConflictDoUpdate({ target: [userId, agentId, pattern], ... })`
- [ ] Replace SELECT/DELETE queries with Drizzle equivalents
- [ ] Remove `DatabaseSignalSubscriptionRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 7: Migrate webhookTasksRepository (6 queries)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace UPSERT and CRUD queries with Drizzle equivalents
- [ ] Remove `DatabaseWebhookTaskRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 8: Migrate heartbeatTasksRepository (7 queries)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace UPSERT, bulk update, and CRUD queries
- [ ] Remove `DatabaseHeartbeatTaskRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 9: Migrate systemPromptsRepository (7 queries, scope-based filtering)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace scope-conditional SELECT queries with Drizzle `.where(and(...))`
- [ ] Replace UPSERT with `.onConflictDoUpdate()`
- [ ] Remove `DatabaseSystemPromptRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 10: Migrate tokenStatsRepository (3 queries, UPSERT with arithmetic)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace UPSERT with arithmetic: use `sql\`${table.col} + ${value}\`` in conflict set
- [ ] Replace dynamic WHERE/LIMIT query with Drizzle conditional builder
- [ ] Remove `DatabaseTokenStatsHourlyRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 11: Migrate signalEventsRepository (10 queries, dynamic filtering)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace dynamic WHERE building with Drizzle conditional `.where(and(...))`
- [ ] Handle reverse pagination with `.orderBy(desc(...))` + `.limit()` + `.offset()`
- [ ] Remove `DatabaseSignalEventRow` usage
- [ ] Update/write tests for filtered queries
- [ ] Run `yarn typecheck && yarn test`

### Task 12: Migrate agentsRepository (7 queries, JSON serialization)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace SELECT/INSERT/UPDATE with Drizzle equivalents
- [ ] Handle JSON serialization: `JSON.stringify()` for descriptor/permissions/tokens/stats in `.values()` and `.set()`
- [ ] Parse JSON on read: map Drizzle results through `agentParse()` (keep existing logic)
- [ ] Replace UPSERT with `.onConflictDoUpdate()`
- [ ] Remove `DatabaseAgentRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 13: Migrate tasksRepository (10 queries, composite primary key UPSERT)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Handle composite PK UPSERT: `.onConflictDoUpdate({ target: [tasksTable.userId, tasksTable.id], ... })`
- [ ] Replace filtered SELECT queries with Drizzle equivalents
- [ ] Remove `DatabaseTaskRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 14: Migrate cronTasksRepository (9 queries, conditional enabled filtering)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace conditional queries (include/exclude disabled) with Drizzle `.where(and(...))`
- [ ] Replace UPSERT with Drizzle equivalent
- [ ] Remove `DatabaseCronTaskRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 15: Migrate channelsRepository (11 queries, dual caching)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace channel CRUD and UPSERT queries
- [ ] Replace member UPSERT with composite unique target
- [ ] Replace member SELECT/DELETE queries
- [ ] Remove `DatabaseChannelRow` and `DatabaseChannelMemberRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 16: Migrate delayedSignalsRepository (10 queries, transactions)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace `BEGIN`/`COMMIT`/`ROLLBACK` with `db.transaction(async (tx) => {...})`
- [ ] Replace cascade delete + insert pattern within transaction
- [ ] Replace SELECT/DELETE queries with Drizzle equivalents
- [ ] Remove `DatabaseDelayedSignalRow` usage
- [ ] Update/write tests including transaction behavior
- [ ] Run `yarn typecheck && yarn test`

### Task 17: Migrate exposeEndpointsRepository (8 queries, JSON objects)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace UPSERT with JSON-serialized target and auth
- [ ] Replace SELECT/DELETE queries
- [ ] Remove `DatabaseExposeEndpointRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 18: Migrate processesRepository (12 queries, 26-field UPSERT)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace large UPSERT (26 fields) with Drizzle `.values({...}).onConflictDoUpdate({...})`
- [ ] Handle JSON serialization for env, permissions, packageManagers, allowedDomains
- [ ] Replace filtered SELECT queries
- [ ] Remove `DatabaseProcessRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 19: Migrate connectionsRepository (8 queries, JOINs, conditional UPSERTs)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace conditional UPSERT variants (user_a/user_b ordering)
- [ ] Replace complex JOIN queries for friends/subusers with Drizzle joins
- [ ] Handle symmetric relationship queries with `or(and(...), and(...))`
- [ ] Remove `DatabaseConnectionRow` usage
- [ ] Update/write tests including JOIN queries
- [ ] Run `yarn typecheck && yarn test`

### Task 20: Migrate usersRepository (12 queries, nametag collision retry)
- [ ] Change constructor to accept `DaycareDb`
- [ ] Replace INSERT/UPDATE/DELETE/SELECT queries with Drizzle
- [ ] Handle `INSERT ... RETURNING id` for connector keys
- [ ] Keep nametag collision retry logic (catch unique constraint error, retry)
- [ ] Remove `DatabaseUserRow` and `DatabaseUserConnectorKeyRow` usage
- [ ] Update/write tests
- [ ] Run `yarn typecheck && yarn test`

### Task 21: Update Storage facade for Drizzle transactions
- [ ] Replace `this.connection.exec("BEGIN")` / `exec("COMMIT")` / `exec("ROLLBACK")` with `drizzle.transaction()`
- [ ] Update `createAgentWithSession()` to use Drizzle transaction
- [ ] Ensure repositories can accept transaction context (`tx`) when called from `Storage`
- [ ] Update/write tests for transactional operations
- [ ] Run `yarn typecheck && yarn test`

### Task 22: Clean up DatabaseXxxRow types
- [ ] Remove all `DatabaseXxxRow` types from `databaseTypes.ts` that are no longer imported
- [ ] Verify no remaining references to removed types
- [ ] Keep `XxxDbRecord` types (app-level), `CreateXxxInput` types, and `UpdateXxxInput` types
- [ ] Run `yarn typecheck && yarn test`

### Task 23: Verify acceptance criteria
- [ ] Verify all 17 repositories use Drizzle query builder (no `db.prepare()` in repositories)
- [ ] Verify `StorageDatabase` is only used in infrastructure files
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`)
- [ ] Run type checker (`yarn typecheck`)
- [ ] Verify no `DatabaseXxxRow` types remain (except where still needed for infra)

### Task 24: Update documentation
- [ ] Update relevant docs in `/doc/` if migration patterns are documented
- [ ] Add migration notes to plan file

## Technical Details

### Type Strategy
- **Remove**: `DatabaseXxxRow` types — Drizzle's `InferSelectModel<typeof xxxTable>` replaces them
- **Keep**: `XxxDbRecord` types — these carry JSON-parsed rich types (e.g., `AgentDescriptor` instead of `string`)
- **Keep**: Parse functions (e.g., `agentParse`) that transform Drizzle rows → app records

### JSON Column Handling
Columns storing JSON (descriptor, permissions, tokens, stats, env, etc.) are `text` in Drizzle schema. Repositories must:
- **Write**: `JSON.stringify(value)` before passing to `.values()` / `.set()`
- **Read**: `JSON.parse(row.column)` after query, same as current parse functions

### Transaction Strategy
- Drizzle `db.transaction(async (tx) => { ... })` replaces manual `BEGIN`/`COMMIT`/`ROLLBACK`
- For repos called within transactions (e.g., from `Storage.createAgentWithSession`), methods should accept an optional `tx` parameter that defaults to `db`

### PGlite Client Access
- `databaseOpen()` currently hides the PGlite client inside `StorageDatabase`
- Need to expose it so `schemaDrizzle(client)` can create the Drizzle instance
- Add `databaseOpenWithClient()` or modify `databaseOpen()` to return `{ db, client }`

## Post-Completion

**Manual verification:**
- Test with `yarn env <name>` to verify end-to-end with file-backed PGlite
- Verify PostgreSQL backend still works (if applicable)

**Performance considerations:**
- Drizzle generates parameterized queries similar to the current raw SQL
- No performance regression expected; may slightly improve due to query plan caching
