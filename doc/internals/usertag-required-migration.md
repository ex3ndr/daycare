# Required Usertags Migration

This migration makes `users.usertag` required for all existing and future users.

## Summary

- Migration: `20260225_require_usertag`
- Backfills missing/empty usertags for existing rows
- Adds a full unique index on `users(usertag)`
- Adds insert/update triggers that reject null or empty usertags

## Data Flow

```mermaid
flowchart TD
    A[Read users table] --> B[Collect existing non-empty usertags]
    B --> C[Find users with null or empty usertag]
    C --> D[Derive deterministic usertag from user id]
    D --> E{Collision?}
    E -- Yes --> D
    E -- No --> F[Update user.usertag]
    F --> G[Create unique index on users.usertag]
    G --> H[Create INSERT/UPDATE triggers]
    H --> I[Reject null/empty usertags at DB layer]
```

## Notes

- Runtime compatibility is preserved by generating a usertag inside `UsersRepository.create()` when callers do not provide one.
- Existing explicit usertag writes continue to work, with uniqueness enforced by DB constraints.
