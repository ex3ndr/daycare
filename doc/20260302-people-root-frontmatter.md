# People Root Document + Frontmatter Validation

## Summary

- Added automatic `vault://people` root entry creation at engine startup.
- Added validation for vault writes under `vault://people`:
  - YAML frontmatter is required implicitly by requiring frontmatter fields.
  - `firstName` must be present and non-empty.
  - `lastName` is optional, but when provided it must be non-empty.
- Applied the validation in both:
  - `vault_write` tool writes
  - App vault API writes (`POST /vault/create`, `POST /vault/:id/update`)

## Flow

```mermaid
flowchart TD
    A[Engine start] --> B[Ensure vault://memory]
    B --> C[Ensure vault://people]

    D[Vault create/update request] --> E{Target under vault://people?}
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
