# PGlite Storage Bootstrap

## Summary
- Storage now uses PGlite-backed PostgreSQL semantics instead of `node:sqlite`.
- Engine opens one DB instance and passes it into storage/repositories.
- Migrations were reset to a single bootstrap migration.
- Schema checks read PostgreSQL catalogs and compare against `sources/schema.ts`.
- Test helper storage uses in-memory DB (`:memory:`) only.

## Runtime Flow
```mermaid
flowchart TD
    A[Engine constructor] --> B[databaseOpen(config.dbPath)]
    B --> C[databaseMigrate(db)]
    C --> D[Storage.fromDatabase(db)]
    D --> E[Repositories use shared db instance]
    E --> F[Optional databaseSchemaMatches(db, schema)]
```

## Test Flow
```mermaid
flowchart TD
    T1[Test setup] --> T2[databaseOpenTest -> :memory:]
    T2 --> T3[databaseMigrate(db)]
    T3 --> T4[Storage.fromDatabase(db)]
    T4 --> T5[Run repository/engine test]
```
