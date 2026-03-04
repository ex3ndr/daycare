# Daycare PSQL Service

## Overview

`PsqlService` provides structured, user-scoped PostgreSQL databases backed by PGlite.
It exposes three operation modes:

1. `schema` mode: additive schema evolution (`table_add`, `column_add`) plus comment updates (`table_comment_set`, `column_comment_set`)
2. `data` mode: structured `add` / `update` / `delete` with row version history
3. `query` mode: read-only SQL (`BEGIN READ ONLY`)

Each user can create multiple isolated databases under:

`<usersDir>/<userId>/databases/<dbId>/`

Metadata (`id`, `name`, `created_at`) is stored in the main storage table `psql_databases`.

## Schema Apply Payload

```json
{
    "table": "contacts",
    "comment": "Contact records",
    "fields": [
        { "name": "first_name", "type": "text", "comment": "Given name" },
        { "name": "age", "type": "integer", "comment": "Age in years", "nullable": true }
    ]
}
```

`table` is always provided separately. Diffing runs only for that table's fields (plus table comment).
`comment` for the table and `comment` for every field are required and must be non-empty.

`GET /databases/:id/schema` introspection still returns full database state as:

```json
{
    "tables": [
        {
            "name": "contacts",
            "comment": "Contact records",
            "columns": [{ "name": "first_name", "type": "text", "comment": "Given name", "nullable": false }]
        }
    ]
}
```

Supported declaration column types:

- `text`
- `integer`
- `real`
- `boolean`
- `jsonb`

## System Columns

Every table managed by this service includes:

- `id` (`text`)
- `version` (`integer`)
- `valid_from` (`bigint`)
- `valid_to` (`bigint`, nullable)
- `created_at` (`bigint`)
- `updated_at` (`bigint`)

Constraints:

- Primary key: `("id", "version")`
- Current-row unique index: `UNIQUE ("id") WHERE "valid_to" IS NULL`

## Data Semantics

### Add

- inserts first version (`version = 1`)
- sets `valid_to = NULL`

### Update

- closes current row (`valid_to = now`)
- inserts `version + 1` row with merged business data

### Delete

- closes current row (`valid_to = now`)
- does not insert a new version

Deletes are represented by the absence of a current version (`valid_to IS NULL`). Full row history remains queryable.

## Query Safety

`query` mode uses a database-enforced read-only transaction (`BEGIN READ ONLY`).

Any write attempt in query mode fails.

## Integration Points

- Core tools:
  - `psql_db_create`
  - `psql_db_list`
  - `psql_schema`
  - `psql_data`
  - `psql_query`
- App API routes:
  - `GET /databases`
  - `POST /databases/create`
  - `GET /databases/:id/schema`
  - `POST /databases/:id/schema`
  - `POST /databases/:id/add`
  - `POST /databases/:id/update`
  - `POST /databases/:id/delete`
  - `POST /databases/:id/query`
