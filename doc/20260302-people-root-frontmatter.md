# People Root Document + Frontmatter Validation

## Summary

- Added automatic `~/people` root document creation at engine startup.
- Added validation for document writes under `~/people`:
  - YAML frontmatter is required implicitly by requiring frontmatter fields.
  - `firstName` must be present and non-empty.
  - `lastName` is optional, but when provided it must be non-empty.
- Applied the validation in both:
  - `document_write` tool writes
  - App document API writes (`POST /documents`, `PUT /documents/:id`)

## Flow

```mermaid
flowchart TD
    A[Engine start] --> B[Ensure ~/memory]
    B --> C[Ensure ~/people]

    D[Document create/update request] --> E{Target under ~/people?}
    E -->|No| F[Proceed without people frontmatter checks]
    E -->|Yes| G[Parse body with gray-matter]
    G --> H{frontmatter.firstName present?}
    H -->|No| I[Reject write]
    H -->|Yes| J{lastName provided?}
    J -->|No| K[Allow write]
    J -->|Yes| L{lastName non-empty?}
    L -->|No| I
    L -->|Yes| K
```
