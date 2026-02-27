# Storage DB Target Settings

Date: 2026-02-26

## Summary

This change adds explicit settings for:

- Selecting a server database via `engine.url`
- Toggling automatic migrations via `engine.autoMigrate`

If `engine.url` is set, storage opens a server Postgres connection.
If not set, storage continues using local PGlite path resolution.

## Config Fields

- `engine.path`: local database path (used for PGlite target)
- `engine.url`: optional server database URL
- `engine.autoMigrate`: optional boolean (default `true`)

## Runtime Flow

```mermaid
flowchart TD
    A[Load Settings] --> B{engine.url set?}
    B -- yes --> C[Open Postgres client]
    B -- no --> D[Open PGlite target from engine.path]
    C --> E{engine.autoMigrate?}
    D --> E
    E -- true --> F[Run databaseMigrate]
    E -- false --> G[Skip migrations]
    F --> H[Storage ready]
    G --> H
```

## Notes

- `storageResolve` cache keys now include backend kind to avoid collisions.
- `storageUpgrade` follows the same target selection (`postgres` vs `pglite`).
- Config parsing no longer enforces a `postgres://` URL prefix.
