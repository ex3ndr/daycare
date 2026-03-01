# Document Store

## Overview

A versioned, hierarchical document store in the core storage layer. Documents form a user-scoped tree with path-based addressing (`~/memory/daily/events`). Each document has a title, description (mandatory), markdown body, and slug (last path segment). Documents reference each other via a separate references table (parent links + cross-references) and via markdown links extracted from the body. Soft delete is allowed only when no other documents reference the deleted document.

**Key outcomes:**
- Two new tables: `documents` (versioned) and `document_references` (non-versioned, tracks parent + cross-refs)
- `DocumentsRepository` with CRUD, versioning, reference integrity, and soft-delete guard
- Paths derived from parent chain + slug; `~/` resolves to current user's root
- Markdown body links auto-extracted into `document_references` on create/update
- Permission/format enforcement is code-level based on path patterns (not stored in documents)

## Context

- **Storage layer**: PGlite/Postgres via Drizzle ORM, temporal versioning (`version`, `validFrom`, `validTo`)
- **Existing patterns**: `TasksRepository` as canonical example — write-through caching, `AsyncLock`, `versionAdvance()`, composite PK `(userId, id, version)`
- **Schema file**: `packages/daycare/sources/schema.ts`
- **Types file**: `packages/daycare/sources/storage/databaseTypes.ts`
- **Storage facade**: `packages/daycare/sources/storage/storage.ts`
- **Migrations**: SQL files in `packages/daycare/sources/storage/migrations/`, registered in `_migrations.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility

## Testing Strategy
- **Unit tests**: required for every task
- All tests run against in-memory PGlite (`:memory:`)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Data Model

### `documents` table (versioned)

| Column | Type | Notes |
|---|---|---|
| `id` | text | cuid2, not null |
| `user_id` | text | not null, scopes all access |
| `version` | integer | default 1 |
| `valid_from` | bigint | unix ms |
| `valid_to` | bigint | null = active |
| `slug` | text | not null, last path segment |
| `title` | text | not null |
| `description` | text | not null |
| `body` | text | not null, markdown content |
| `created_at` | bigint | unix ms |
| `updated_at` | bigint | unix ms |

- **PK**: `(user_id, id, version)`
- **Unique index**: `(user_id, parent document ref's target_id, slug) WHERE valid_to IS NULL` — enforced at application level since it spans two tables
- **Index**: `(id, valid_to)` for active lookups

### `document_references` table (non-versioned, rebuilt on each document version)

| Column | Type | Notes |
|---|---|---|
| `id` | serial | auto PK |
| `user_id` | text | not null |
| `source_id` | text | not null, the document containing the reference |
| `source_version` | integer | not null, ties to exact document version |
| `target_id` | text | not null, the referenced document |
| `kind` | text | not null: `"parent"`, `"link"`, `"body"` |

- A document has exactly **one** `kind="parent"` reference (except user root docs which have none)
- `"link"` = explicit cross-references added via API
- `"body"` = auto-extracted from markdown links in the body
- **Unique index**: `(source_id, source_version, target_id, kind)`
- **Index**: `(target_id)` — for "who references me?" queries (soft delete guard)
- **Index**: `(source_id, source_version)` — for "what does this doc reference?"

### Path resolution

- Path = parent chain of slugs joined by `/`, prefixed with `~/`
- Example: doc with slug `events`, parent slug `daily`, parent slug `memory` → `~/memory/daily/events`
- `~/` is shorthand for current user's root (no physical root document; root docs have no parent ref)
- Path is computed, not stored — derived by walking the parent chain

### Reference rules

1. Every non-root document must have exactly one `kind="parent"` reference
2. Root documents (e.g., `memory`) have no parent reference
3. A document can have many `kind="link"` and `kind="body"` references
4. Soft delete is blocked if any active document references the target (any kind)
5. On document update, `kind="body"` references are rebuilt by re-extracting markdown links

### Markdown link extraction

Extract `[[slug]]` or `[[path/to/doc]]` patterns from markdown body. Resolve to document IDs. Store as `kind="body"` references. Unresolvable links are silently ignored (no dangling refs).

## Implementation Steps

### Task 1: Add migration for `documents` and `document_references` tables
- [ ] Create `packages/daycare/sources/storage/migrations/20260228_documents.sql` with both table definitions, indexes, and constraints
- [ ] Register migration in `_migrations.ts`
- [ ] Write test that migration applies cleanly on empty database
- [ ] Run tests — must pass before next task

### Task 2: Add Drizzle schema definitions and database types
- [ ] Add `documentsTable` and `documentReferencesTable` to `packages/daycare/sources/schema.ts` following existing patterns (versioned columns, indexes)
- [ ] Add `schema` export entries for both tables
- [ ] Add `DatabaseDocumentRow`, `DocumentDbRecord`, `DatabaseDocumentReferenceRow`, `DocumentReferenceDbRecord` types to `databaseTypes.ts`
- [ ] Add `DocumentReferenceKind` type (`"parent" | "link" | "body"`)
- [ ] Write tests for parse functions (`documentParse`, `documentReferenceParse`)
- [ ] Run tests — must pass before next task

### Task 3: Implement `DocumentsRepository` — core CRUD
- [ ] Create `packages/daycare/sources/storage/documentsRepository.ts`
- [ ] Implement `findById(ctx, id)` with write-through caching
- [ ] Implement `findBySlugAndParent(ctx, slug, parentId)` for path-based lookups
- [ ] Implement `findChildren(ctx, parentId)` to list subdocuments
- [ ] Implement `findRoots(ctx)` to list root documents (no parent ref)
- [ ] Implement `create(record, refs)` — insert document + references (parent, links, body-extracted)
- [ ] Implement `update(ctx, id, data, refs)` — version advance + rebuild references
- [ ] Implement `delete(ctx, id)` — soft delete with reference guard (reject if any active doc references this one)
- [ ] Write tests for create, read, update, delete (success cases)
- [ ] Write tests for error/edge cases (delete blocked by refs, duplicate slug under same parent, missing parent)
- [ ] Run tests — must pass before next task

### Task 4: Implement path resolution and markdown link extraction
- [ ] Create `packages/daycare/sources/storage/documentPathResolve.ts` — walk parent chain to build full path from document ID
- [ ] Create `packages/daycare/sources/storage/documentPathFind.ts` — resolve a path string (`~/memory/daily/events`) to a document ID by walking slug segments
- [ ] Create `packages/daycare/sources/storage/documentBodyRefs.ts` — extract `[[...]]` links from markdown body, resolve to document IDs
- [ ] Write tests for path resolution (root doc, nested doc, deep nesting)
- [ ] Write tests for path finding (valid path, invalid path, partial path)
- [ ] Write tests for body reference extraction (no links, valid links, unresolvable links)
- [ ] Run tests — must pass before next task

### Task 5: Wire into Storage facade
- [ ] Add `documents: DocumentsRepository` to `Storage` class
- [ ] Instantiate in constructor
- [ ] Write integration test: create user → create root doc → create child doc → resolve path → delete child → delete root
- [ ] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [ ] Verify all requirements from Overview are implemented
- [ ] Verify edge cases: soft delete guard, slug uniqueness under parent, version history preserved
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`)

### Task 7: [Final] Update documentation
- [ ] Document the document store in `doc/documents.md` with mermaid diagrams for the data model and reference graph

## Technical Details

### Table DDL (migration)

```sql
CREATE TABLE documents (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    valid_from BIGINT NOT NULL,
    valid_to BIGINT,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, id, version)
);

CREATE INDEX idx_documents_user_id ON documents (user_id);
CREATE INDEX idx_documents_id_valid_to ON documents (id, valid_to);
CREATE INDEX idx_documents_slug ON documents (user_id, slug) WHERE valid_to IS NULL;

CREATE TABLE document_references (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_version INTEGER NOT NULL,
    target_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('parent', 'link', 'body'))
);

CREATE UNIQUE INDEX idx_doc_refs_unique ON document_references (source_id, source_version, target_id, kind);
CREATE INDEX idx_doc_refs_target ON document_references (target_id);
CREATE INDEX idx_doc_refs_source ON document_references (source_id, source_version);
CREATE INDEX idx_doc_refs_parent ON document_references (target_id, kind) WHERE kind = 'parent';
```

### Reference management on create/update

```
1. Insert/advance document version
2. Extract [[...]] links from body → resolve to target IDs
3. Insert document_references rows for:
   a. parent (kind="parent") — from input
   b. explicit links (kind="link") — from input
   c. body links (kind="body") — from extraction
   (old version's refs remain in the table, tied to old source_version)
```

### Soft delete guard

```
Before setting validTo on a document:
1. Query document_references WHERE target_id = ? AND kind IN ('parent', 'link')
2. For each ref, check if source document is still active (validTo IS NULL, version matches latest)
3. If any active document references this one → reject delete
   (body refs do NOT block deletion — they'll become stale naturally)
```

### Path resolution algorithm

```
function documentPathResolve(ctx, docId):
    segments = []
    current = docId
    while current:
        doc = findById(ctx, current)
        segments.unshift(doc.slug)
        parentRef = findParentRef(current)
        current = parentRef?.targetId ?? null
    return "~/" + segments.join("/")
```

## Post-Completion

**Manual verification:**
- Test with actual memory agent writing to `~/memory/...` path
- Verify version history is queryable for audit

**Future work (not in scope):**
- Code-level path pattern matching for permission/format enforcement
- Seeding initial root documents (e.g., `memory`) on user creation
- Search/query across document body content
