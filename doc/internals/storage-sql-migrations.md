# Storage SQL Migrations

Storage migrations now run from raw `.sql` files instead of TypeScript migration modules.

## Why

- Easier to copy, review, and share migration SQL directly.
- Keeps migration content in one format (SQL) for local and production usage.
- Preserves existing migration names in `_migrations` for compatibility.

## Flow

```mermaid
flowchart TD
  A[Engine or upgrade command] --> B[migrationRun]
  B --> C[Ensure _migrations table exists]
  C --> D[Read applied names]
  D --> E{Migration applied?}
  E -->|yes| F[Skip]
  E -->|no| G[Read SQL file]
  G --> H[BEGIN]
  H --> I[Execute full SQL migration]
  I --> J[Insert migration name into _migrations]
  J --> K[COMMIT]
```

## Current SQL migration files

- `20260226_bootstrap.sql` - schema bootstrap + owner seed.
- `20260227_user_profile.sql` - adds structured user profile columns.

