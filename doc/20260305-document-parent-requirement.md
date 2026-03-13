# Document Parent Enforcement And Root Ensure

## Summary

- `POST /vault/create` now requires `parentId`.
- Engine startup now ensures `vault://vault` exists for the owner user.
- App vault creation paths now default to the ensured root vault id when no explicit parent is chosen.

## Flow

```mermaid
flowchart TD
    A[Engine start] --> B[Ensure vault://memory]
    B --> C[Ensure vault://people]
    C --> D[Ensure vault://vault]
    D --> E[App fetches vault entries]
    E --> F[App resolves root vault id]
    F --> G[User creates vault entry]
    G --> H{parentId present?}
    H -- no --> I[Reject 400 from POST /vault/create]
    H -- yes --> J[Create vault entry under parent]
```

## Notes

- This keeps root-level user vault creation blocked while still allowing root setup via engine ensure functions.
