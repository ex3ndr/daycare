# Entity Versioning

## Overview
Add temporal versioning to 12 mutable database entities. Instead of in-place UPDATE, each mutation inserts a new row with an incremented `version`, setting `valid_to` on the previous row and `valid_from` on the new one. This creates a full audit trail of every entity state change.

**End result:**
- All 12 tables gain `version` (integer, starts at 1), `valid_from` (bigint, unix ms), `valid_to` (bigint | null — null = current)
- Primary keys include `version`
- `UPDATE` operations become `INSERT new version + close previous version`
- `SELECT` for current state filters `WHERE valid_to IS NULL`
- Advancing a version requires `new.valid_from = previous.valid_to`
- Existing data migrated to version 1

**Tables:**
users, agents, tasks, tasks_cron, tasks_heartbeat, tasks_webhook, signals_subscriptions, channels, expose_endpoints, processes, connections, system_prompts

**NOT versioned:** sessions, token_stats_hourly

## Context
- Schema: `packages/daycare/sources/schema.ts` (Drizzle ORM, pgTable)
- Types: `packages/daycare/sources/storage/databaseTypes.ts`
- Repositories: `packages/daycare/sources/storage/*Repository.ts`
- Migrations: `packages/daycare/sources/storage/migrations/`
- DB: PostgreSQL (PGlite for tests, node-postgres for prod)

## Design Decisions

### FK constraints
Adding `version` to PKs means `id` alone is no longer unique. Foreign keys from other tables that reference versioned tables by `id` cannot work. **Drop all FK constraints** that reference versioned tables. Application-level integrity is already enforced through the repository layer.

Affected FKs to drop:
- `user_connector_keys.user_id` → `users.id`
- `sessions.agent_id` → `agents.id`
- `users.parent_user_id` → `users.id` (self-referential)
- `tasks_cron/heartbeat/webhook.(user_id, task_id)` → `tasks.(user_id, id)`
- `connections.user_a_id/user_b_id` → `users.id`
- `token_stats_hourly.user_id` → `users.id`
- `token_stats_hourly.agent_id` → `agents.id`
- `channel_members.channel_id` → `channels.id`
- `channel_messages.channel_id` → `channels.id`

### Unique indexes
Unique constraints (nametag, channel name, signals_subscriptions composite) become partial unique indexes: `WHERE valid_to IS NULL` — uniqueness applies only to current versions.

### onConflictDoUpdate → check-then-advance
Repositories using upsert (`onConflictDoUpdate`) must be rewritten. Since PK now includes `version`, a simple upsert doesn't work. Pattern becomes: find current version → if exists, advance version; if not, create version 1.

### Runtime state on processes
Every field change on `processes` (pid, status, restart_count, etc.) creates a new version. This is by design — it provides a full history of process state transitions.

## Development Approach
- Complete each task fully before moving to the next
- Every task includes tests
- Run `yarn test` after each task
- Run `yarn lint` and `yarn typecheck` after each task

## Implementation Steps

### Task 1: Add versioning columns to Drizzle schema
- [ ] Add `version` (integer, NOT NULL, default 1), `validFrom` (bigint, NOT NULL), `validTo` (bigint, nullable) columns to all 12 tables in `schema.ts`
- [ ] Change primary keys to include `version`: simple PK tables become `primaryKey({ columns: [table.id, table.version] })`, composite PK tables add `version` to their existing composite
- [ ] Drop FK constraints from schema definitions: remove all `foreignKey()` and `.references()` calls that target versioned tables
- [ ] Convert unique indexes to partial: `users.nametag`, `channels.name`, `signals_subscriptions.(userId, agentId, pattern)` — add `.where(sql\`valid_to IS NULL\`)`
- [ ] Add index on `(id, valid_to)` for each table (efficient current-version lookups)
- [ ] Run `yarn typecheck` to verify schema compiles

### Task 2: Update database types
- [ ] Add `version: number`, `validFrom: number`, `validTo: number | null` to all 12 `*DbRecord` types in `databaseTypes.ts`
- [ ] Add `version: number`, `valid_from: number`, `valid_to: number | null` to all 12 `Database*Row` types
- [ ] Run `yarn typecheck` — expect failures in repositories (will fix in subsequent tasks)

### Task 3: Write and register migration SQL
- [ ] Create `20260228_entity_versioning.sql` in `sources/storage/migrations/`
- [ ] For each of 12 tables: `ALTER TABLE ADD COLUMN version integer`, `ALTER TABLE ADD COLUMN valid_from bigint`, `ALTER TABLE ADD COLUMN valid_to bigint`
- [ ] Backfill existing rows: `SET version = 1, valid_from = created_at, valid_to = NULL` (for `connections` which has no `created_at`, use a fixed epoch or `requested_a_at`/`requested_b_at`)
- [ ] Set NOT NULL constraints after backfill: `ALTER COLUMN version SET NOT NULL`, `ALTER COLUMN valid_from SET NOT NULL`
- [ ] Drop old primary keys and recreate with version included
- [ ] Drop FK constraints that reference versioned tables
- [ ] Drop old unique indexes and recreate as partial (WHERE valid_to IS NULL)
- [ ] Create performance indexes: `(id, valid_to)` for each table
- [ ] Register migration in `_migrations.ts`
- [ ] Write test: apply migration on empty DB, verify schema
- [ ] Run `yarn test` — migration test must pass

### Task 4: Create version advance helper
- [ ] Create `sources/storage/versionAdvance.ts` with `versionAdvance()` function
- [ ] Function takes: db, table reference, where clause for current row, new field values
- [ ] Logic: find current (valid_to IS NULL) → set valid_to = now → insert new row with version+1, valid_from = now, valid_to = NULL
- [ ] Return the new version number
- [ ] Write tests for versionAdvance (success, not-found error, idempotency)
- [ ] Run `yarn test`

### Task 5: Update UsersRepository
- [ ] Modify `create()`: set version=1, validFrom=createdAt, validTo=null on insert
- [ ] Modify `update()`: use version advance pattern (close current version, insert new version) instead of `db.update()`
- [ ] Modify all SELECT queries (`findById`, `findMany`, `findByNametag`, `findOwner`, `findByParentUserId`): add `isNull(usersTable.validTo)` filter
- [ ] Modify `delete()`: set `valid_to = now` on current version instead of `db.delete()`
- [ ] Update cache logic: cache always stores current version only
- [ ] Update tests in `usersRepository.spec.ts`
- [ ] Write test: create user, update, verify old version exists with valid_to set
- [ ] Run `yarn test`

### Task 6: Update AgentsRepository
- [ ] Modify `create()`: set version=1, validFrom=createdAt, validTo=null; replace `onConflictDoUpdate` with check-then-advance
- [ ] Modify `update()`: use version advance pattern instead of `db.update()`
- [ ] Modify all SELECT queries: add `isNull(agentsTable.validTo)` filter
- [ ] Update tests
- [ ] Write test: create agent, update, verify version history
- [ ] Run `yarn test`

### Task 7: Update TasksRepository
- [ ] Modify `create()`: set version=1, validFrom=createdAt, validTo=null; replace `onConflictDoUpdate` with check-then-advance
- [ ] Modify `update()`: use version advance pattern
- [ ] Modify `delete()` (soft delete): advance version with deletedAt set + validTo on previous
- [ ] Modify all SELECT queries: add `isNull(tasksTable.validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 8: Update CronTasksRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify `update()`: use version advance pattern
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 9: Update HeartbeatTasksRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify `update()` and `recordRun()`: use version advance pattern
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 10: Update WebhookTasksRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo
- [ ] Modify `recordRun()`: use version advance pattern
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 11: Update SignalSubscriptionsRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Update tests
- [ ] Run `yarn test`

### Task 12: Update ChannelsRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify `update()`: use version advance pattern
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 13: Update ExposeEndpointsRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify `update()`: use version advance pattern
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 14: Update ProcessesRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify `update()`: use version advance pattern (every field change = new version)
- [ ] Modify `delete()` and `deleteByOwner()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 15: Update ConnectionsRepository
- [ ] Modify `upsertRequest()`: set version=1 on create, advance version on update; PK is now (user_a_id, user_b_id, version)
- [ ] Modify `clearSide()`: use version advance pattern
- [ ] Modify `delete()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 16: Update SystemPromptsRepository
- [ ] Modify `create()`: set version=1, validFrom, validTo; replace upsert with check-then-advance
- [ ] Modify `updateById()`: use version advance pattern
- [ ] Modify `deleteById()`: set valid_to instead of hard delete
- [ ] Modify all SELECT queries: add `isNull(validTo)` filter
- [ ] Update tests
- [ ] Run `yarn test`

### Task 17: Verify acceptance criteria
- [ ] All 12 tables have version, valid_from, valid_to columns in schema
- [ ] All PKs include version
- [ ] All repository UPDATEs create new versions instead of in-place updates
- [ ] All repository SELECTs filter for current version (valid_to IS NULL)
- [ ] All repository DELETEs close current version (set valid_to) instead of hard delete
- [ ] Migration backfills existing data correctly
- [ ] Run full `yarn test`
- [ ] Run `yarn lint` — fix any issues
- [ ] Run `yarn typecheck` — no errors

### Task 18: Update documentation
- [ ] Update `doc/` with versioning design and mermaid diagrams
- [ ] Document version advance pattern and conventions

## Technical Details

### Version advance pattern
```typescript
// 1. Find current version
const current = await db.select().from(table)
    .where(and(eq(table.id, id), isNull(table.validTo)))
    .limit(1);

// 2. Close current version
const now = Date.now();
await db.update(table)
    .set({ validTo: now })
    .where(and(eq(table.id, id), eq(table.version, current.version)));

// 3. Insert new version
await db.insert(table).values({
    ...current,
    ...changes,
    version: current.version + 1,
    validFrom: now,
    validTo: null,
    updatedAt: now,
});
```

### PK changes
| Table | Old PK | New PK |
|-------|--------|--------|
| users | (id) | (id, version) |
| agents | (id) | (id, version) |
| tasks | (user_id, id) | (user_id, id, version) |
| tasks_cron | (id) | (id, version) |
| tasks_heartbeat | (id) | (id, version) |
| tasks_webhook | (id) | (id, version) |
| signals_subscriptions | (id) | (id, version) |
| channels | (id) | (id, version) |
| expose_endpoints | (id) | (id, version) |
| processes | (id) | (id, version) |
| connections | (user_a_id, user_b_id) | (user_a_id, user_b_id, version) |
| system_prompts | (id) | (id, version) |

### Partial unique indexes (current version only)
- `users.nametag` → `UNIQUE ON (nametag) WHERE valid_to IS NULL`
- `channels.name` → `UNIQUE ON (name) WHERE valid_to IS NULL`
- `signals_subscriptions.(user_id, agent_id, pattern)` → `UNIQUE ON (...) WHERE valid_to IS NULL`

## Post-Completion
- Verify migration on a real PostgreSQL instance (not just PGlite)
- Monitor version table growth in production
- Consider adding a `version_history_query` utility for debugging/admin
