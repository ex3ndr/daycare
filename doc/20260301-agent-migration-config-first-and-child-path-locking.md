# 20260301 Agent Migration: Config-First Semantics and Child Path Allocation Lock

## Summary

This change removes path-derived semantic backfills from the `20260301` agent migrations and makes child path allocation safe under concurrent calls.

- Agent semantic columns (`kind`, `model_role`, `connector_name`, `parent_agent_id`) are backfilled from config/legacy metadata, not path parsing.
- `agentPathChildAllocate` now serializes allocation by `parentAgentId` to avoid duplicate child indexes.

## Migration flow

```mermaid
flowchart TD
    A[Legacy agents rows] --> B[Ensure semantic/config columns exist]
    B --> C[Backfill missing path from legacy type+descriptor]
    C --> D[Resolve kind/modelRole/connectorName/parentAgentId from config and legacy metadata]
    D --> E[Normalize defaults and null invalid combinations]
    E --> F[Enforce not-null/default constraints]
    F --> G[Drop legacy type/descriptor/config columns]
```

## Child allocation flow

```mermaid
flowchart TD
    A[Request child path for parentAgentId] --> B[Acquire per-parent AsyncLock]
    B --> C[Read parent.nextSubIndex]
    C --> D[Write parent.nextSubIndex + 1]
    D --> E[Return path with allocated index]
    E --> F[Release lock]
```

## Why

- Path parsing for semantic data couples routing shape to persistence semantics and creates fragile migrations.
- Split read/write allocation without a shared lock can return duplicate child indexes during parallel tool calls.
