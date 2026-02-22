# Extract memorySessionProcess and count end turns

## Overview
- Extract `processSession` from `MemoryWorker` into a standalone function `memorySessionProcess` in its own file
- Move auto-invalidation from `Storage.appendHistory` to `Agent` runtime
- Count "end turns" (completed `handleMessage` calls) purely in memory — no DB queries or persistence
- Reset counter on session reset / compaction

## Final Implementation

### `memorySessionProcess` (extracted)
- `engine/memory/memorySessionProcess.ts` — standalone function receiving `SessionDbRecord` and `Storage`
- `MemoryWorker` imports and calls it instead of a private method

### End turn counting (runtime in Agent)
- `Agent.endTurnCount` field — incremented after each `handleMessage` completes
- `Agent.invalidateSessionIfNeeded()` — when count > 5, calls `sessions.invalidate()`
- Counter resets to 0 on `handleReset` and `applyCompactionSummary` (new session)
- Removed `countSinceId` and `countEndTurnsSinceId` from `HistoryRepository` (no longer needed)
- Removed auto-invalidation from `Storage.appendHistory` (moved to Agent)

### Files changed
- `engine/memory/memorySessionProcess.ts` — new
- `engine/memory/memorySessionProcess.spec.ts` — new
- `engine/memory/memoryWorker.ts` — uses external function
- `engine/agents/agent.ts` — `endTurnCount` field + `invalidateSessionIfNeeded()`
- `storage/storage.ts` — removed auto-invalidation from `appendHistory`
- `storage/historyRepository.ts` — removed `countSinceId` and `countEndTurnsSinceId`
- `storage/historyRepository.spec.ts` — removed corresponding tests
- `storage/storage.spec.ts` — removed invalidation tests (moved to agent)
