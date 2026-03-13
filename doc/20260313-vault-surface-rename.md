# Vault Surface Rename

Date: 2026-03-13

## Summary

- Renamed the public documents surface to `vault` across app routes, API routes, prompts, and tool names.
- Kept storage compatibility intact: the filesystem home folder still stays `documents/`, and database tables still stay `documents` plus `document_references`.
- Preserved legacy `doc://...` path resolution for stored content so existing refs continue to resolve without a migration.

## Contract Map

```mermaid
flowchart TD
    A[App UI] --> B[/vault]
    B --> C[Vault store + vault views]

    D[App client] --> E[GET /vault/tree]
    D --> F[GET /vault/:id]
    D --> G[GET /vault/:id/history]
    D --> H[POST /vault/create]
    D --> I[POST /vault/:id/update]
    D --> J[POST /vault/:id/delete]

    K[Prompt and agent surface] --> L[vault://vault]
    K --> M[vault://memory]
    K --> N[vault://system]
    K --> O[vault_read / vault_write / vault_patch / vault_append / vault_tree / vault_search]

    O --> P[documentsRepository]
    P --> Q[(documents)]
    P --> R[(document_references)]
    S[User home] --> T[home/documents]
```

## Compatibility Notes

- Root vault entries still use the stored slug `document` internally, but public path rendering now exposes that root as `vault://vault`.
- `documentPathFind` and body-ref resolution accept both `vault://...` and legacy `doc://...` inputs.
- No database migration is required for this rename.
