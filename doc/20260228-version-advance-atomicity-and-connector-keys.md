# Version Advance Atomicity and Connector Key Lifecycle

## Summary

This change addresses two correctness issues:

- Version advancement now executes inside a database transaction at every repository call site.
- User delete now removes `user_connector_keys` rows in the same transaction as closing the current user row.

## Atomic Version Advance

```mermaid
sequenceDiagram
    participant Repo as Repository
    participant DB as Database (tx)

    Repo->>DB: BEGIN
    Repo->>DB: UPDATE current SET valid_to = now
    Repo->>DB: INSERT next version (version+1, valid_from=now, valid_to=NULL)
    DB->>Repo: COMMIT
```

If insert fails, transaction rollback keeps the previous row current.

## User Delete + Connector Keys

```mermaid
sequenceDiagram
    participant Users as UsersRepository
    participant DB as Database (tx)

    Users->>DB: BEGIN
    Users->>DB: UPDATE users SET valid_to = now WHERE id=? AND valid_to IS NULL
    Users->>DB: DELETE FROM user_connector_keys WHERE user_id=?
    DB->>Users: COMMIT
```

This allows `resolveUserByConnectorKey(...)` to create a fresh user after deletion without unique-key conflicts.

## Migration

A cleanup migration removes stale connector keys already pointing to users with no current version:

- `20260228_user_connector_keys_cleanup.sql`
