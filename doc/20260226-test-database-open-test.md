# Test databaseOpenTest for in-memory SQLite

## Summary

Tests now open SQLite through `databaseOpenTest`/`storageOpenTest` so they run in memory only.

## Design

- `databaseOpenTest(key?)` opens named in-memory SQLite (`mode=memory&cache=shared`).
- A per-key anchor connection stays open so reopen flows work during a test.
- File-like keys are attached as virtual DB paths for migrations that resolve paths via `databasePathResolve`.
- `databaseOpen` supports a test override hook, enabled by `databaseOpenTest`, so code paths that still call `databaseOpen(config.dbPath)` in tests are redirected to the in-memory backend.

```mermaid
flowchart TD
    Spec[Test spec] -->|storageOpenTest or databaseOpenTest| TestOpen[databaseOpenTest]
    TestOpen --> Anchor[(Anchor connection per key)]
    TestOpen --> Conn[(Test connection)]
    Conn --> Migrate[databaseMigrate]
    Migrate --> Repos[Storage repositories]

    Runtime[Code under test calling databaseOpen(dbPath)] --> Hook[databaseOpen override hook]
    Hook --> TestOpen

    Conn --> PathMeta[virtual database path]
    PathMeta --> PathResolve[databasePathResolve]
    PathResolve --> ImportMigrations[import migrations read legacy files]
```
