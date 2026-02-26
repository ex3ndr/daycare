# Daycare Engine-Owned DB (Drizzle + better-sqlite3)

## Summary
- Runtime DB access now uses `better-sqlite3` (no `node:sqlite` import usage).
- Drizzle schema is centralized at `packages/daycare/sources/schema.ts`.
- DB lifecycle helpers are centralized in storage: `databaseOpen`, `databaseMigrate`, `databaseClose`.
- Engine creates one DB instance on startup, builds `Storage` from it, and closes it on shutdown.

## Runtime Flow
```mermaid
flowchart TD
    A[startCommand] --> B[configLoad]
    B --> C[new Engine]
    C --> D[databaseOpen(config.dbPath)]
    D --> E[databaseMigrate(db)]
    E --> F[Storage.fromDatabase(db)]
    F --> G[Repositories]
    G --> H[Engine runtime]
    H --> I[databaseClose(storage.db) on shutdown]
```

## Test/Compatibility Notes
- `Storage.open(...)` has been removed; `Storage` only accepts an already-open DB via `Storage.fromDatabase(db)`.
- `storageOpen(dbPath)` is a composition helper in `storage/` that runs `databaseOpen` + `databaseMigrate` + `Storage.fromDatabase` for convenience (tests and utility paths).
- `storageResolve(config)` uses per-path cached `storageOpen(...)`; no global DB lookup remains.
- `storageUpgrade` uses `databaseOpen` + `databaseMigrate` + `databaseClose`.

## Schema Match Check
- Added `databaseSchemaMatches(db)` in `sources/storage/databaseSchemaMatches.ts`.
- It uses Drizzle metadata (`getTableConfig`) to compare expected tables/columns/indexes against live SQLite metadata (`sqlite_master` + `PRAGMA`).
- Result includes `matches` plus mismatch details (`missingTables`, `unexpectedTables`, and per-table issues).

```mermaid
flowchart TD
    A[databaseSchemaMatches(db)] --> B[Read expected metadata from schema.ts via getTableConfig]
    A --> C[Read actual metadata from sqlite_master + PRAGMA]
    B --> D[Compare tables]
    C --> D
    D --> E[Compare columns + indexes per table]
    E --> F[Return matches + mismatch report]
```
