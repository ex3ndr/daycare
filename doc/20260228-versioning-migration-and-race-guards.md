# 20260228 Versioning Migration And Race Guards

## Summary
- Fixed task migration backfill so legacy soft-deleted tasks remain deleted after `deleted_at` is dropped.
- Hardened `versionAdvance` to require exactly one closed current row before inserting the next version.
- Prevented delete-vs-`recordRun` resurrection races for heartbeat/webhook triggers by combining per-task locks with fresh reads.
- Added pair-level lock coverage for `connections.clearSide` and `connections.delete`.

## Migration Backfill
```mermaid
flowchart LR
    A[Legacy tasks row<br/>deleted_at = null] --> B[version=1<br/>valid_from=created_at<br/>valid_to=null]
    C[Legacy tasks row<br/>deleted_at = T] --> D[version=1<br/>valid_from=created_at<br/>valid_to=T]
    B --> E[Drop deleted_at column]
    D --> E
```

## Concurrent Delete vs recordRun
```mermaid
sequenceDiagram
    participant RR as recordRun(task)
    participant LK as task lock
    participant DB as tasks_* table
    participant DEL as delete(task)

    RR->>LK: acquire
    RR->>DB: reload current where valid_to IS NULL
    RR->>DB: close current (must affect 1 row)
    RR->>DB: insert next version
    RR->>LK: release
    DEL->>LK: acquire
    DEL->>DB: set valid_to=now on current
    DEL->>LK: release
```

## Notes
- Regression tests added for:
  - Migration from pre-versioning schema with existing deleted tasks.
  - Deterministic delete-vs-`recordRun` races for webhook and heartbeat trigger repositories.
- Full `packages/daycare` typecheck and test suite pass with these changes.
