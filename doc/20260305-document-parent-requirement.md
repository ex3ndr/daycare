# Document Parent Enforcement And Root Ensure

## Summary

- `POST /documents` now requires `parentId`.
- Engine startup now ensures `~/document` exists for the owner user.
- App document creation paths now default to the ensured `~/document` id when no explicit parent is chosen.

## Flow

```mermaid
flowchart TD
    A[Engine start] --> B[Ensure ~/memory]
    B --> C[Ensure ~/people]
    C --> D[Ensure ~/document]
    D --> E[App fetches documents]
    E --> F[App resolves document root id]
    F --> G[User creates document]
    G --> H{parentId present?}
    H -- no --> I[Reject 400 from POST /documents]
    H -- yes --> J[Create document under parent]
```

## Notes

- This keeps root-level user document creation blocked while still allowing root setup via engine ensure functions.
