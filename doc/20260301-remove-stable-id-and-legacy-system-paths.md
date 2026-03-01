# Remove Stable ID And Legacy System Paths (2026-03-01)

## Summary

This change removes stable-id derivation from agent paths and finishes the cleanup of path-as-source-of-truth behavior in the touched areas.

Key updates:
- removed path-derived stable id allocation in `agentSystem`
- updated tests to resolve runtime `agentId` from target/path instead of descriptor id assumptions
- dropped legacy system-agent descriptor support from test utilities
- removed Telegram path/target helper parsing functions that reverse-engineered ids from path strings
- removed repository-side legacy helper branches flagged in review comments
- removed kind-mapping heuristics in `agentsRepository`; `kind` now stays as provided (`input.kind`/current), without normalization
- switched task verify context label from `task-verify` to `task`

## Runtime Identity Flow

```mermaid
flowchart TD
    A[Post to path target] --> B{Existing agent for path?}
    B -->|Yes| C[Reuse existing agentId]
    B -->|No| D[createId() generates new agentId]
    D --> E[Persist agent with explicit kind/config]
    C --> F[Handle inbox item]
    E --> F[Handle inbox item]
```

## Why

Path segments are not treated as authoritative semantic storage for runtime identity. Agent identity is now always record-driven at creation and reused by persisted path lookups.

## Test Coverage

- updated `agentSystem.spec.ts` to assert path identity reuse, not descriptor-id reuse
- updated `agent.spec.ts` signal/lifecycle tests to use resolved runtime agent ids
- full workspace checks passed:
  - `yarn lint`
  - `yarn typecheck`
  - `yarn test`
