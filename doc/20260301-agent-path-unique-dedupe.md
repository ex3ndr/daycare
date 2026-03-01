# 20260301 Agent Paths: Active-Path Deduping Before Unique Index

## Summary

`20260301_agents_unified.sql` closes duplicate active rows that resolve to the same `agents.path` before creating `idx_agents_path_active`.

This prevents migration failure on legacy data where multiple active agents map to one logical path (for example `/system/task`).

## Migration flow

```mermaid
flowchart TD
    A[Backfill agents.path from legacy type/descriptor] --> B[Backfill agents.config from descriptor]
    B --> C[Rank active rows per path by updated_at, created_at, version, id]
    C --> D[Keep rank 1 active row per path]
    D --> E[Set valid_to on rank > 1 rows]
    E --> F[Create unique index on active path rows]
```

## Why

- Existing deployments can have legacy duplicates with `valid_to IS NULL`.
- Creating the unique active-path index without cleanup fails migration startup.
- Closing older duplicates preserves one canonical active row per path and unblocks migration.
