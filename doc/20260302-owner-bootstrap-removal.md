# Remove owner bootstrap seeding

## Summary
- Removed automatic owner user insertion from SQL bootstrap migration.
- Kept test stability by seeding a test-only owner in `storageOpenTest()`.
- Updated owner-migration test setup to create an explicit non-owner user instead of relying on bootstrap data.

## Migration behavior
```mermaid
flowchart TD
    A[databaseMigrate on fresh DB] --> B[20260226_bootstrap schema/indexes]
    B --> C[No INSERT owner row]
    C --> D[users table starts empty]
```

## Test behavior
```mermaid
flowchart TD
    T[storageOpenTest] --> M[Run migrations]
    M --> Q[Check storage.users.findOwner()]
    Q -->|missing| S[Create test owner sy45...]
    Q -->|exists| R[Reuse existing owner]
```
