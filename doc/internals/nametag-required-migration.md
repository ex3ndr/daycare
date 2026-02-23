# Required Nametags Migration

This migration makes `users.nametag` required for all existing and future users.

## Summary

- Migration: `20260225_require_nametag`
- Backfills missing/empty nametags for existing rows
- Adds a full unique index on `users(nametag)`
- Adds insert/update triggers that reject null or empty nametags
- Uses `unique-username-generator` for generated nametags (`separator=""`, `randomDigits=3`)

## Data Flow

```mermaid
flowchart TD
    A[Read users table] --> B[Collect existing non-empty nametags]
    B --> C[Find users with null or empty nametag]
    C --> D[Generate nametag via unique-username-generator]
    D --> E{Collision?}
    E -- Yes --> D
    E -- No --> F[Update user.nametag]
    F --> G[Create unique index on users.nametag]
    G --> H[Create INSERT/UPDATE triggers]
    H --> I[Reject null/empty nametags at DB layer]
```

## Notes

- Runtime compatibility is preserved by generating a nametag inside `UsersRepository.create()` when callers do not provide one.
- Existing explicit nametag writes continue to work, with uniqueness enforced by DB constraints.
