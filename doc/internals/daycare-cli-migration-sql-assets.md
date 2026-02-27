# Daycare CLI Migration SQL Assets

The CLI bootstrap migration (`20260226_bootstrap`) reads `0000_bootstrap.sql` from a path relative to `dist/storage/migrations`.

The build step now explicitly copies SQL migration assets into `dist/storage/migrations` so global npm installs include required files.

```mermaid
flowchart LR
    Build[daycare-cli build] --> TSC[Emit dist/**/*.js]
    Build --> CopySQL[Copy sources/storage/migrations/*.sql to dist/storage/migrations]
    Runtime[daycare runtime startup] --> Migration[20260226_bootstrap]
    Migration --> ReadSQL[readFileSync dist/storage/migrations/0000_bootstrap.sql]
    ReadSQL --> Apply[Execute statements]
```
