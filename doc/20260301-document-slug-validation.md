# Document Slug Validation

## Summary

This change makes vault slugs path-safe so vault paths like `vault://memory/user` remain unambiguous.

## What Changed

- Added `documentSlugNormalize` to trim and validate slugs.
- Rejected slugs containing `/` in:
  - `vault_write` tool input handling.
  - `DocumentsRepository` create/update/lookup normalization.
- Updated Python tooling guidance examples to use `vault_read` instead of removed memory tools.
- Added tests for:
  - slug rejection in tool and repository layers.
  - path round-trip correctness for valid slugs.

## Validation Flow

```mermaid
flowchart TD
    A[vault_write input slug] --> B[documentSlugNormalize]
    B -->|valid| C[DocumentsRepository.create/update]
    B -->|invalid contains / or empty| E[Error]
    C --> D[Stored slug segment]
    D --> F[documentPathResolve joins with /]
    F --> G[vault://a/b/c path]
    G --> H[documentPathFind splits on /]
    H --> I[Original document id]
```
