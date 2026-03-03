# Daycare App Per-User KV Storage

## Summary

Added untyped key-value storage scoped by `ctx.userId` in core storage and exposed it in the authenticated App API.

Storage:
- New `key_values` table (`user_id`, `key`, `value`, `created_at`, `updated_at`)
- New `KeyValuesRepository` on `Storage` facade
- New migration: `20260303101000_user_key_values.sql`

API:
- `GET /kv`
- `GET /kv/:key`
- `POST /kv/create`
- `POST /kv/:key/update`
- `POST /kv/:key/delete`

## Flow

```mermaid
sequenceDiagram
    participant App as Daycare App Client
    participant Api as AppServer /kv routes
    participant Repo as KeyValuesRepository
    participant DB as key_values table

    App->>Api: POST /kv/create { key, value }
    Api->>Repo: create(ctx, key, value)
    Repo->>DB: INSERT (ctx.userId, key, value)
    DB-->>Repo: created row
    Repo-->>Api: entry
    Api-->>App: { ok: true, entry }

    App->>Api: GET /kv/:key
    Api->>Repo: findByKey(ctx, key)
    Repo->>DB: SELECT by (user_id, key)
    DB-->>Repo: row or null
    Repo-->>Api: entry or null
    Api-->>App: 200/404
```
