# Memory

The memory plugin provides structured entity storage using Markdown files. It allows agents to create, update, and query persistent knowledge.

## Storage layout

Memory files live under `<workspace>/memory/`:

| File | Purpose |
|------|---------|
| `INDEX.md` | Lists all entity types |
| `<entity>.md` | Records for that entity type |

## Entity format

Entity names must be lowercase English letters only (a-z, no underscores).

```markdown
---
name: "Ada Lovelace"
description: "Pioneer of computing."
---

# person

## Ada Lovelace
Pioneer of computing.

## Alan Turing
Father of computer science.
```

### Constraints

| Field | Limit |
|-------|-------|
| Entity name | Lowercase a-z only |
| Name | Max 60 characters, single line |
| Description | Max 160 characters, single line |

## Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `memory_create_entity` | `entity`, `name`, `description` | Create or update an entity file and add to INDEX.md |
| `memory_upsert_record` | `entity`, `record`, `content` | Add or update a `## <record>` section |
| `memory_list_entities` | `limit` (optional) | List entities with short name/description |
