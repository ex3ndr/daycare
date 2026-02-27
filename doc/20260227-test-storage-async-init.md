# Daycare Tests: Async Storage Initialization for Agent Suites

## Summary
- Updated flaky/failed agent-related specs to initialize storage with async migration-aware helpers (`storageOpen`) instead of relying on synchronous `storageResolve` side effects.
- Kept production `storageResolve` behavior unchanged.

## Files Updated
- `packages/daycare/sources/engine/agents/agent.spec.ts`
- `packages/daycare/sources/engine/agents/agentSystem.spec.ts`
- `packages/daycare/sources/engine/agents/ops/agentDescriptorWrite.spec.ts`
- `packages/daycare/sources/engine/agents/ops/agentStateRead.spec.ts`
- `packages/daycare/sources/engine/modules/tools/sessionHistoryToolBuild.spec.ts`

## Why
- Tests were intermittently failing with missing tables (`agents`, `signals_delayed`) due race conditions between test startup and background migrations.
- Async-opened storage ensures migrations are applied before test actions execute.

## Test Setup Flow
```mermaid
flowchart LR
    A[Test starts] --> B[configResolve]
    B --> C[storageOpen(config.db.path)]
    C --> D[databaseOpen]
    D --> E[databaseMigrate awaits]
    E --> F[Storage ready]
    F --> G[AgentSystem/test operations]
```
