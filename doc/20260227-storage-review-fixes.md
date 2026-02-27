# Storage Review Fixes

Date: 2026-02-27

## Summary

This change addresses four review findings:

- Migrations now use async contracts (`Promise<void>`) and migration runners await them.
- Snapshot persistence no longer performs SQLite-specific DB file fsync calls.
- Test-backend guidance now states in-memory **PGlite** instead of SQLite.
- `schemaDrizzleBuild` was renamed to `schemaDrizzle` to follow naming rules.

## Migration Flow

```mermaid
flowchart TD
    A[databaseMigrate(db)] --> B[migrationRun(db)]
    B --> C[for each migration]
    C --> D[migration.up(db): Promise<void>]
    D --> E[queue SQL operations]
    E --> F[await Promise.all operations]
    F --> G[next migration]
```

## Snapshot Durability

`rlmSnapshotSave` now only syncs:

- snapshot file contents
- snapshot directory metadata

The previous DB-path fsync step was removed because runtime storage is PGlite, not SQLite WAL files.

## Notes

- `databaseMigrate` now returns `Promise<string[]>`.
- Non-async bootstrap call paths continue to trigger migrations via `void databaseMigrate(db)`.
