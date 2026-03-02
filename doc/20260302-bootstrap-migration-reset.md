# Bootstrap migration reset (single-file)

## Summary
- Removed legacy incremental SQL migrations.
- Added one fresh bootstrap migration with timestamp prefix: `20260302165030_bootstrap.sql`.
- Updated migration registry to a single entry.
- Updated migration tests to validate bootstrap apply, schema parity, and idempotency.

## Migration flow
```mermaid
flowchart TD
    A[databaseMigrate] --> B[migrationRun ensures _migrations table]
    B --> C[Apply 20260302165030_bootstrap.sql]
    C --> D[Insert migration name into _migrations]
    D --> E[Runtime repositories operate on final schema]
```

## Schema strategy
```mermaid
flowchart LR
    Legacy[Many step-by-step migrations] --> Reset[Single bootstrap migration]
    Reset --> Final[Creates final versioned tables directly]
    Final --> Match[databaseSchemaMatches == true]
```
