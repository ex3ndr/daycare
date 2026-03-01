# Daycare Document Store

The document store provides versioned, user-scoped markdown documents with hierarchical paths and explicit references.

## Tables

```mermaid
erDiagram
    DOCUMENTS {
        text id
        text user_id
        int version
        bigint valid_from
        bigint valid_to
        text slug
        text title
        text description
        text body
        bigint created_at
        bigint updated_at
    }

    DOCUMENT_REFERENCES {
        int id
        text user_id
        text source_id
        int source_version
        text target_id
        text kind
    }

    DOCUMENTS ||--o{ DOCUMENT_REFERENCES : "source(id, version)"
```

- `documents` uses temporal versioning: `(user_id, id, version)`.
- `document_references` rows are immutable per source version.
- `kind` values are `parent`, `link`, `body`.

## Path Resolution

```mermaid
flowchart TD
    A[doc id] --> B[load active document]
    B --> C{parent ref exists?}
    C -->|yes| D[prepend slug and load parent]
    D --> C
    C -->|no| E[build ~/slug/slug path]
```

- Paths are computed from active `parent` references.
- Roots have no `parent` reference and resolve to `~/slug`.

## Version + Reference Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Repo as DocumentsRepository
    participant DB as Database

    Client->>Repo: create/update document
    Repo->>Repo: validate parent + link targets
    Repo->>Repo: extract body refs ([[...]] -> ids)
    Repo->>DB: close current version (update only)
    Repo->>DB: insert next document version
    Repo->>DB: insert parent/link/body refs for that version
```

- Updating a document creates a new version and a new set of refs.
- Old reference rows remain tied to old versions.
- Delete is blocked when an active document has `parent` or `link` reference to the target.
- Parent links are validated as acyclic before writes; cycle-creating updates are rejected.
- Concurrent writes to the same `(user, parent, slug)` scope are serialized to preserve sibling slug uniqueness.
