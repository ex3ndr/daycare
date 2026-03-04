# PSQL Service

## Overview

A core service that provides structured, versioned PostgreSQL databases to both LLM (via tools) and App API (via REST endpoints). Replaces the existing database plugin with a safer, more structured approach.

Each user can have **multiple isolated PGlite databases**, each with an auto-generated ID and a required display name. The service operates in three modes:

1. **Schema mode** - Additive-only schema changes (new tables, new columns) plus comment updates. Apply payload is single-table (`table` + `comment` + `fields[]`). Diffing is field-level for the specified table only. Destructive changes (drops, type alterations) are rejected.
2. **Data mode** - Structured `add`, `update`, `delete` operations. Every table automatically gets system columns (`id`, `version`, `valid_from`, `valid_to`, `created_at`, `updated_at`). Updates create new versioned rows. Deletes close the current version (`valid_to = now`) without creating a replacement current row.
3. **Query mode** - Read-only SQL execution. Enforced via `SET TRANSACTION READ ONLY` to prevent any writes through this path.

### Key outcomes
- LLM gets three tools: `psql_schema`, `psql_data`, `psql_query`
- App API gets REST endpoints mirroring all three modes under `/databases/`
- Existing database plugin is removed
- All databases are PGlite, stored under the user's home: `<usersDir>/<userId>/databases/<dbId>/` (extends `UserHome` with a `databases` path)
- Database metadata (id, name, created_at) tracked in main storage DB

## Context
- Existing database plugin: `sources/plugins/database/plugin.ts` - gives raw SQL access, no safety guardrails
- Versioning pattern: `sources/storage/versionAdvance.ts` - close current row + insert version+1
- PGlite setup: `sources/storage/databaseOpen.ts` - wraps PGlite with queue-based serialization
- Plugin tool registration: `api.registrar.registerTool()` with TypeBox schemas
- API route convention: `POST /<domain>/create`, `POST /<domain>/:id/update`, etc.

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility during transition

## Testing Strategy
- **Unit tests**: required for every task
- Pure functions (schema diffing, SQL generation, column building) get thorough unit tests
- Service integration tests use in-memory PGlite (`:memory:`)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Define psql service types
- [x] Create `sources/services/psql/psqlTypes.ts` with core types:
  - `PsqlDatabase` - metadata record (id, userId, name, createdAt)
  - `PsqlColumnDef` - JSON schema for a column (`name`, `type`: text/integer/real/boolean/jsonb, `nullable?`)
  - `PsqlTableSchema` - JSON schema for a table (`name`, `columns: PsqlColumnDef[]`)
  - `PsqlSchemaDeclaration` - full schema declaration (`tables: PsqlTableSchema[]`)
  - `PsqlDataOp` - discriminated union: `{ op: "add", table, data }`, `{ op: "update", table, id, data }`, `{ op: "delete", table, id }`
  - System columns list constant: `PSQL_SYSTEM_COLUMNS`
- [x] Write tests for type guards / discriminated union validation
- [x] Run tests - must pass before next task

### Task 2: Schema introspection (`psqlSchemaIntrospect`)
- [x] Create `sources/services/psql/psqlSchemaIntrospect.ts`
- [x] Query `information_schema.tables` and `information_schema.columns` from a PGlite instance
- [x] Return a `PsqlSchemaDeclaration` representing the current database state (excluding system columns from the output)
- [x] Write tests using in-memory PGlite with pre-created tables
- [x] Run tests - must pass before next task

### Task 3: Schema diff and apply (`psqlSchemaDiff`, `psqlSchemaApply`)
- [x] Create `sources/services/psql/psqlSchemaDiff.ts` - pure function that compares desired vs current schema
  - Returns list of changes: `table_add`, `column_add`
  - Returns errors for: table removal, column removal, column type change, column rename
- [x] Create `sources/services/psql/psqlSchemaApply.ts` - generates and executes SQL DDL from diff result
  - `CREATE TABLE` with system columns auto-added + business columns
  - `ALTER TABLE ADD COLUMN` for new columns
  - Primary key is always `(id, version)`
  - Partial unique index on `id WHERE valid_to IS NULL` for current-row lookups
- [x] Write tests for diff (pure function): new table, new column, reject removal, reject type change
- [x] Write tests for apply: execute against in-memory PGlite and verify via introspection
- [x] Run tests - must pass before next task

### Task 4: Data operations (`psqlDataAdd`, `psqlDataUpdate`, `psqlDataDelete`)
- [x] Create `sources/services/psql/psqlDataAdd.ts`
  - Generates INSERT with system columns: `id` (auto-gen nanoid), `version=1`, `valid_from=now`, `valid_to=NULL`, `created_at=now`, `updated_at=now`
  - Returns the inserted record
- [x] Create `sources/services/psql/psqlDataUpdate.ts`
  - Finds current row (`valid_to IS NULL`)
  - Closes current row (`valid_to = now`)
  - Inserts new row with `version+1`, merged data, `updated_at=now`
  - Returns the new record
- [x] Create `sources/services/psql/psqlDataDelete.ts`
  - Finds current row (`valid_to IS NULL`)
  - Closes current row (`valid_to = now`)
  - Does not insert a new row/version
  - Returns the closed record
- [x] Write tests for add: insert and verify row with system columns
- [x] Write tests for update: verify version increment, old row closed, new row current
- [x] Write tests for delete: verify soft delete flag, version increment
- [x] Write tests for error cases: update non-existent, delete non-existent, delete already-deleted
- [x] Run tests - must pass before next task

### Task 5: Query execution (`psqlQuery`)
- [x] Create `sources/services/psql/psqlQuery.ts`
  - Wraps query in read-only transaction: `BEGIN READ ONLY; ... COMMIT;`
  - Relies on database-enforced read-only mode (no SQL keyword parsing)
  - Returns rows as JSON array
- [x] Write tests: successful SELECT, reject INSERT/UPDATE/DELETE through query mode
- [x] Run tests - must pass before next task

### Task 6: Database lifecycle (`psqlDatabaseCreate`, `psqlDatabaseList`, `psqlDatabaseOpen`)
- [x] Create `sources/services/psql/psqlDatabaseCreate.ts` - creates PGlite at `<usersDir>/<userId>/databases/<dbId>/` (add `databases` path to `UserHome`), stores metadata
- [x] Create `sources/services/psql/psqlDatabaseList.ts` - lists databases for a user from metadata store
- [x] Create `sources/services/psql/psqlDatabaseOpen.ts` - opens/caches PGlite instance by (userId, dbId)
- [x] Decide metadata storage: either a table in main storage DB or a JSON file per user
- [x] Write tests for create, list, open lifecycle
- [x] Run tests - must pass before next task

### Task 7: PSQL service facade (`PsqlService`)
- [x] Create `sources/services/psql/PsqlService.ts` - facade class that ties together all operations
  - `createDatabase(userId, name): PsqlDatabase`
  - `listDatabases(userId): PsqlDatabase[]`
  - `applySchema(userId, dbId, declaration): SchemaResult`
  - `getSchema(userId, dbId): PsqlSchemaDeclaration`
  - `add(userId, dbId, table, data): Record`
  - `update(userId, dbId, table, id, data): Record`
  - `delete(userId, dbId, table, id): Record`
  - `query(userId, dbId, sql, params?): Row[]`
- [x] Manages PGlite instance cache (open on demand, hold in memory)
- [x] Uses AsyncLock per (userId, dbId) for write serialization
- [x] Write integration tests exercising full lifecycle
- [x] Run tests - must pass before next task

### Task 8: LLM tools registration
- [x] Create `sources/services/psql/psqlTools.ts` - registers three tools:
  - `psql_schema` - apply schema declaration to a database (params: `dbId`, `table`, `comment`, `fields[]`)
  - `psql_data` - execute data operation (params: dbId, op discriminated union)
  - `psql_query` - execute read-only query (params: dbId, sql, params?)
- [x] Include a `psql_db_create` tool for creating new databases
- [x] Include a `psql_db_list` tool for listing databases
- [x] Define TypeBox schemas for each tool's parameters and results
- [x] Each tool delegates to `PsqlService`
- [x] Write tests for tool parameter validation
- [x] Run tests - must pass before next task

### Task 9: App API routes
- [x] Create `sources/api/routes/databases/databasesRoutes.ts` with endpoints:
  - `GET /databases` - list user's databases
  - `POST /databases/create` - create database (body: `{ name }`)
  - `GET /databases/:id/schema` - get current schema
  - `POST /databases/:id/schema` - apply schema declaration
  - `POST /databases/:id/add` - add record (body: `{ table, data }`)
  - `POST /databases/:id/update` - update record (body: `{ table, id, data }`)
  - `POST /databases/:id/delete` - delete record (body: `{ table, id }`)
  - `POST /databases/:id/query` - execute query (body: `{ sql, params? }`)
- [x] Register routes in central `apiRouteHandle` dispatcher
- [x] Write tests for route handling
- [x] Run tests - must pass before next task

### Task 10: Wire service into engine and remove old plugin
- [x] Instantiate `PsqlService` in engine startup, pass to tool registration and API routes
- [x] Remove `sources/plugins/database/` plugin directory
- [x] Remove database plugin from plugin registry/config
- [x] Add system prompt fragment listing available databases and their schemas
- [x] Verify no remaining references to old plugin
- [x] Run full test suite
- [x] Run linter - all issues must be fixed

### Task 11: Documentation
- [x] Create `sources/services/psql/README.md` documenting:
  - Service overview and three modes
  - JSON schema format for table declarations
  - System columns auto-added to every table
  - Data operation semantics (versioning, soft delete)
  - Query mode safety guarantees
- [x] Update `doc/` with architecture diagram (mermaid)
- [x] Run linter

## Technical Details

### JSON Schema Format (input to schema mode)
```json
{
  "table": "contacts",
  "comment": "Contact records",
  "fields": [
    { "name": "first_name", "type": "text", "comment": "Given name" },
    { "name": "last_name", "type": "text", "comment": "Family name" },
    { "name": "email", "type": "text", "comment": "Primary email", "nullable": true },
    { "name": "age", "type": "integer", "comment": "Age in years", "nullable": true }
  ]
}
```

### System Columns (auto-added)
| Column | Type | Description |
|--------|------|-------------|
| `id` | `text` | Nanoid, auto-generated on add |
| `version` | `integer` | Starts at 1, increments on update |
| `valid_from` | `bigint` | Unix ms when this version became current |
| `valid_to` | `bigint` | Unix ms when superseded (NULL = current) |
| `created_at` | `bigint` | Unix ms when first created |
| `updated_at` | `bigint` | Unix ms of last modification |

Primary key: `(id, version)`
Current row index: `UNIQUE (id) WHERE valid_to IS NULL`

### Supported Column Types
| JSON type | PostgreSQL type |
|-----------|----------------|
| `text` | `text` |
| `integer` | `integer` |
| `real` | `real` |
| `boolean` | `boolean` |
| `jsonb` | `jsonb` |

### Data Flow

```mermaid
flowchart TD
    LLM[LLM Agent] --> Tools[psql_schema / psql_data / psql_query tools]
    App[App API] --> Routes[/databases/* REST endpoints]
    Tools --> Service[PsqlService facade]
    Routes --> Service
    Service --> Schema[psqlSchemaDiff + psqlSchemaApply]
    Service --> Data[psqlDataAdd / Update / Delete]
    Service --> Query[psqlQuery - read only]
    Schema --> PG[PGlite instance per db]
    Data --> PG
    Query --> PG
    Service --> Meta[Database metadata in main DB]
```

### Query Mode Safety
```sql
BEGIN READ ONLY;
SELECT * FROM contacts WHERE valid_to IS NULL;
COMMIT;
```
PGlite enforces the read-only transaction at the engine level - any DML statement will fail.

## Post-Completion

**Manual verification:**
- Test schema evolution: create table, add columns, verify rejection of destructive changes
- Test data lifecycle: add → update → soft delete → query history
- Test query safety: attempt INSERT through query mode, verify rejection
- Verify LLM can discover databases and use all three tools in a conversation
- Test App API endpoints with curl/httpie
