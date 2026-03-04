---
name: psql
description: Work with user-scoped PostgreSQL databases (PGlite). Use when the user asks to store structured data, create tables, query rows, track records, build a database, or manage any tabular/relational information. Covers database creation, additive schema design, CRUD operations, and SQL queries.
---

# PSQL Databases

Daycare provides user-scoped PostgreSQL databases powered by PGlite. Each user can create multiple named databases with declarative schemas and full SQL query support.

## Tools

| Tool | Purpose |
|------|---------|
| `psql_db_create` | Create a new named database |
| `psql_db_list` | List all databases for the current user |
| `psql_schema` | Declare or extend a table's schema (additive only) |
| `psql_data` | Add, update, or delete rows |
| `psql_query` | Run read-only SQL queries |

## Core Concepts

### Additive Schema Model

Schemas are **additive only** — you can add tables and columns but never drop or rename them. This guarantees data safety and keeps migrations simple.

Every table automatically gets **system columns** managed by the engine:

| System Column | Type | Description |
|---------------|------|-------------|
| `id` | text | Stable row identity (auto-generated UUID on add) |
| `version` | integer | Monotonic version number per row id |
| `valid_from` | integer | Unix ms when this version became active |
| `valid_to` | integer? | Unix ms when this version was superseded (null = current) |
| `created_at` | integer | Unix ms when the row was first created |
| `updated_at` | integer | Unix ms when this version was written |
| `deleted` | boolean | Soft-delete flag |

You only declare your **user columns**. System columns are added automatically.

### Supported Column Types

| Type | PostgreSQL | Use For |
|------|------------|---------|
| `text` | `text` | Strings, names, descriptions, URLs |
| `integer` | `bigint` | Whole numbers, counts, unix timestamps |
| `real` | `double precision` | Decimal numbers, prices, measurements |
| `boolean` | `boolean` | Flags, toggles |
| `jsonb` | `jsonb` | Nested objects, arrays, flexible data |

### Versioned Row History

Every update creates a **new version** of the row. The previous version is marked with a `valid_to` timestamp. This means:

- Updates never destroy data — old versions are preserved.
- You can query historical state by filtering on `valid_from`/`valid_to`.
- The current version always has `valid_to IS NULL` and `deleted = false`.

Deletes set `deleted = true` on a new version rather than removing the row.

## Workflow

### 1. Create a Database

```
psql_db_create(name: "my-project")
→ { id: "abc123", name: "my-project" }
```

Use a descriptive name. The returned `id` is needed for all subsequent operations.

### 2. Define Tables

Declare tables one at a time. Each call to `psql_schema` is idempotent — re-declaring existing columns is safe (as long as the type matches).

```
psql_schema(
  dbId: "abc123",
  table: "contacts",
  comment: "People and organizations the user interacts with.",
  fields: [
    { name: "name", type: "text", comment: "Full name." },
    { name: "email", type: "text", comment: "Primary email address.", nullable: true },
    { name: "company", type: "text", comment: "Company or organization.", nullable: true },
    { name: "tags", type: "jsonb", comment: "Freeform tags as a JSON array.", nullable: true }
  ]
)
```

**Every field needs a `comment`** — this documents the schema and helps the model understand what each column stores.

To add columns later, call `psql_schema` again with the same table name and the new fields included. Existing columns are left unchanged.

### 3. Add Data

```
psql_data(
  dbId: "abc123",
  op: {
    op: "add",
    table: "contacts",
    data: { name: "Alice", email: "alice@example.com", tags: ["friend", "eng"] }
  }
)
→ { id: "row-uuid", name: "Alice", ... }
```

The `id` is auto-generated. Only provide your user columns in `data`.

### 4. Update Data

```
psql_data(
  dbId: "abc123",
  op: {
    op: "update",
    table: "contacts",
    id: "row-uuid",
    data: { company: "Acme Inc" }
  }
)
```

Partial updates are supported — only include fields you want to change. A new version is created; the old version is preserved.

### 5. Delete Data

```
psql_data(
  dbId: "abc123",
  op: {
    op: "delete",
    table: "contacts",
    id: "row-uuid"
  }
)
```

Soft-deletes the row. The record stays in history with `deleted = true`.

### 6. Query Data

Use standard SQL. Results are returned as an array of row objects.

```
psql_query(
  dbId: "abc123",
  sql: "SELECT id, name, email FROM contacts WHERE deleted = false AND valid_to IS NULL ORDER BY name",
  params: []
)
```

**Always filter for current rows** with `valid_to IS NULL AND deleted = false` unless you specifically want historical data.

## Query Patterns

### Get all current rows from a table

```sql
SELECT * FROM contacts
WHERE valid_to IS NULL AND deleted = false
ORDER BY created_at DESC
```

### Search by field value

```sql
SELECT * FROM contacts
WHERE valid_to IS NULL AND deleted = false
  AND email = $1
```

Use `$1`, `$2`, etc. for parameterized queries and pass values in the `params` array.

### Count rows

```sql
SELECT COUNT(*) as total FROM contacts
WHERE valid_to IS NULL AND deleted = false
```

### Query JSONB fields

```sql
-- Check if a tag exists in a JSONB array
SELECT * FROM contacts
WHERE valid_to IS NULL AND deleted = false
  AND tags @> '["friend"]'::jsonb

-- Extract a nested JSONB field
SELECT name, tags->>'role' as role FROM contacts
WHERE valid_to IS NULL AND deleted = false
```

### View row history

```sql
-- All versions of a specific row
SELECT * FROM contacts
WHERE id = $1
ORDER BY version ASC
```

### Aggregate queries

```sql
SELECT company, COUNT(*) as count
FROM contacts
WHERE valid_to IS NULL AND deleted = false
GROUP BY company
ORDER BY count DESC
```

## Schema Design Guidelines

### Naming

- Table names: lowercase, plural, underscores (`order_items`, `project_tasks`)
- Column names: lowercase, underscores (`first_name`, `due_date`)
- Be descriptive but concise

### When to Use JSONB

Use `jsonb` for:
- Variable-length lists (tags, labels, categories)
- Nested objects that don't need their own table
- Data whose shape varies per row
- Metadata or extra attributes

Use regular columns for:
- Fields you filter or sort on frequently
- Fields with a fixed, known type
- Fields that benefit from type validation

### Nullable Columns

Mark a column `nullable: true` when:
- The value is optional (not every row will have it)
- The value may not be known at creation time
- The column is added to an existing table (existing rows will have null)

### Separate Tables vs JSONB

Use separate tables when:
- You need to query the related data independently
- The relationship is many-to-many
- You need referential integrity

Use JSONB when:
- The nested data is always read/written with the parent
- The structure is simple (lists of strings, small config objects)
- You won't need to join on the nested data

## Tips

- **Check existing databases first**: call `psql_db_list` before creating a new database — the user may already have one.
- **Schema is in the system prompt**: when databases exist, their schema appears in the system prompt so you already know the table structure.
- **Idempotent schema**: re-applying the same `psql_schema` call is safe, so you can include full table definitions in automation without worrying about duplicates.
- **Parameterized queries**: always use `$1`, `$2` params instead of string interpolation to avoid SQL injection.
- **JSONB for flexibility**: when the user's data doesn't fit a rigid schema, use a `jsonb` column for the flexible parts.
