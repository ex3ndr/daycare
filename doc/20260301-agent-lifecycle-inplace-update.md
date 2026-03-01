# Agent Lifecycle In-Place Update

## Summary

`AgentsRepository.update(...)` now keeps the same row/version when the effective change is runtime-only.

- If only runtime fields changed, repository runs `UPDATE` on the current row.
- Any other agent field change still uses temporal versioning (`valid_to` close + `version + 1` insert).

This avoids creating extra agent versions for lifecycle churn.

## Runtime Fields (In-Place)

- `lifecycle`
- `nextSubIndex`
- `activeSessionId`
- `tokens`
- `stats`
- `updatedAt`

## Flow

```mermaid
flowchart TD
    A[AgentsRepository.update] --> B{Only runtime fields changed?}
    B -->|Yes| C[UPDATE current active row]
    C --> D[Keep same version]
    B -->|No| E[versionAdvance]
    E --> F[Close current row valid_to]
    F --> G[Insert next row with version+1]
```
