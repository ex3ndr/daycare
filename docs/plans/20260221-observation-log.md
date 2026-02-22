# Observation Log (observations.md)

## Overview
- Append all extracted observations to a persistent `observations.md` file in each user's memory directory
- Provides a chronological, human-readable log of everything the memory system observes
- Plain markdown file (not a graph node) — direct `fs.appendFile` approach

## Context
- **Where observations are extracted**: `memorySessionObserve.ts` runs inference and returns `InferObservation[]`
- **Where observations are consumed**: `memoryWorker.ts` calls `memorySessionObserve` in `tick()` — currently discards the result
- **Memory directory**: resolved via `UserHome.memory` → `users/<userId>/home/memory/`
- **Observation shape**: `{ text: string; context: string }`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Implementation Steps

### Task 1: Create observationLogAppend utility
- [ ] Create `packages/daycare/sources/engine/memory/observationLogAppend.ts`
- [ ] Implement `observationLogAppend(memoryDir: string, observations: InferObservation[]): Promise<void>`
- [ ] Format each observation as timestamped markdown entry:
  ```
  ## 2026-02-21 14:30
  - **Text**: <text>
  - **Context**: <context>

  ```
- [ ] Use `fs.appendFile` to append to `<memoryDir>/observations.md`
- [ ] Ensure directory exists before writing (`fs.mkdir` with `recursive: true`)
- [ ] Skip writing if observations array is empty
- [ ] Write tests in `observationLogAppend.spec.ts` — success case (appends formatted entries), empty array (no-op), multiple observations (all appended)
- [ ] Run tests — must pass before next task

### Task 2: Wire observationLogAppend into MemoryWorker
- [ ] In `memoryWorker.ts`, import `observationLogAppend`
- [ ] After `memorySessionObserve` returns, call `observationLogAppend` with the user's memory directory and the returned observations
- [ ] Resolve memory dir using `UserHome` (same pattern as `Memory.resolveMemoryDir`)
- [ ] Store the `usersDir` in the worker (add to `MemoryWorkerOptions`)
- [ ] Write/update tests in `memoryWorker.spec.ts` to verify `observationLogAppend` is called with correct arguments
- [ ] Run tests — must pass before next task

### Task 3: Verify acceptance criteria
- [ ] Verify observations are appended in correct timestamped markdown format
- [ ] Verify empty observation arrays don't create empty entries
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`)

### Task 4: Update documentation
- [ ] Update memory README if one exists in `sources/engine/memory/`

## Technical Details

**File location**: `users/<userId>/home/memory/observations.md`

**Entry format** (one per observation):
```markdown
## 2026-02-21 14:30
- **Text**: Dense fact or preference extracted from conversation
- **Context**: Situation narrative explaining why it matters

```

**Data flow**:
```mermaid
graph LR
    A[MemoryWorker.tick] --> B[memorySessionObserve]
    B --> C[InferObservation[]]
    C --> D[observationLogAppend]
    D --> E[observations.md]
```

## Post-Completion
- Monitor observation logs in production to verify quality and density
- Consider adding log rotation if file grows large (future work)
