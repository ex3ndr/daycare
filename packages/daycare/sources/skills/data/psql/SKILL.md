---
name: psql
description: Work with user-scoped PostgreSQL databases (PGlite). Use when the user asks to store structured data, create tables, query rows, track records, build a database, or manage any tabular/relational information. Covers database creation, additive schema design, CRUD operations, and SQL queries.
tools:
  - psql_db_create
  - psql_db_list
  - psql_schema
  - psql_data
  - psql_query
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
- The current version always has `valid_to IS NULL`.

Deletes mark the current version with a `valid_to` timestamp, so deleted rows no longer appear in `valid_to IS NULL` queries.

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
  comment: "People and organizations the user interacts with. Used to look up contact info, track relationships, and filter by company or role.",
  fields: [
    { name: "name", type: "text", comment: "Full display name of the person or organization. Used as the primary label in listings and search results." },
    { name: "email", type: "text", comment: "Primary email address for reaching this contact. Nullable because some contacts are tracked before email is known.", nullable: true },
    { name: "company", type: "text", comment: "Company or organization this contact belongs to. Used to group contacts by employer and filter by affiliation.", nullable: true },
    { name: "tags", type: "jsonb", comment: "Freeform classification tags stored as a JSON array of strings (e.g. [\"friend\", \"eng\"]). Used for flexible filtering and grouping beyond fixed columns.", nullable: true }
  ]
)
```

**Every field needs a `comment` that explains intent, not just the data type.** Good comments describe *why* this field exists and *how* it will be used — not just *what* it stores. This helps the model make better decisions about which columns to query and how to present results.

| Bad comment | Good comment |
|-------------|--------------|
| "The user's email." | "Primary email for reaching this contact. Nullable because some contacts are added before email is exchanged." |
| "Price value." | "Unit price in USD before tax. Used to compute order totals and displayed on invoices." |
| "Status flag." | "Whether the task is currently actionable. Set to false when completed or deferred, used to filter active work views." |
| "Created timestamp." | "When the project was first registered. Used to sort by age and compute time-to-completion metrics." |

The same principle applies to the **table comment** — describe the purpose and how the table fits into the user's workflow.

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

Soft-deletes the row by closing the current version (sets `valid_to`). The record stays in history but no longer appears in `valid_to IS NULL` queries.

### 6. Query Data

Use standard SQL. Results are returned as an array of row objects.

```
psql_query(
  dbId: "abc123",
  sql: "SELECT id, name, email FROM contacts WHERE valid_to IS NULL ORDER BY name",
  params: []
)
```

**Always filter for current rows** with `valid_to IS NULL` unless you specifically want historical data.

## Query Patterns

### Get all current rows from a table

```sql
SELECT * FROM contacts
WHERE valid_to IS NULL
ORDER BY created_at DESC
```

### Search by field value

```sql
SELECT * FROM contacts
WHERE valid_to IS NULL
  AND email = $1
```

Use `$1`, `$2`, etc. for parameterized queries and pass values in the `params` array.

### Count rows

```sql
SELECT COUNT(*) as total FROM contacts
WHERE valid_to IS NULL
```

### Query JSONB fields

```sql
-- Check if a tag exists in a JSONB array
SELECT * FROM contacts
WHERE valid_to IS NULL
  AND tags @> '["friend"]'::jsonb

-- Extract a nested JSONB field
SELECT name, tags->>'role' as role FROM contacts
WHERE valid_to IS NULL
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
WHERE valid_to IS NULL
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
