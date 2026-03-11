## Overview

Decouple scheduling from the agent loop by introducing a thin `Scheduler` class that sits between cron triggers and `TaskExecutions`. This is the **minimal first step** — a pure refactoring that creates the abstraction layer without changing behavior. The Scheduler is a passthrough wrapper today; future PRs will add queuing, prioritization, and rate limiting.

## Context

**Repository:** `~/developer/daycare-platform/`  
**Branch:** `refactor/scheduler-decouple` (from `main`)  
**Language:** TypeScript  
**Build/Test:** `yarn jest` (use `--cache-folder ~/tmp/yarn-cache`)

### Current Architecture
```
CronScheduler timer → Crons.onTask → agentSystem.taskExecutions.dispatch() → TaskExecutionRunner → agentSystem.taskExecuteAndAwait()
```

The `Crons` class directly depends on `AgentSystem` to:
1. Build agent paths via `agentPathTask` (imported directly)
2. Access `agentSystem.taskExecutions.dispatch()` to run tasks

### Target Architecture (this PR)
```
CronScheduler timer → Crons.onTask → Scheduler.dispatch() → TaskExecutions.dispatch() → TaskExecutionRunner → agentSystem.taskExecuteAndAwait()
```

The `Crons` class will depend on `Scheduler` instead of `AgentSystem`. The Scheduler is a thin passthrough that delegates to `TaskExecutions`.

### Key Files
- `packages/daycare/sources/engine/cron/crons.ts` (259 lines) — Crons facade
- `packages/daycare/sources/engine/tasks/taskExecutions.ts` (243 lines) — dispatch bookkeeping
- `packages/daycare/sources/engine/tasks/taskExecutionRunner.ts` (129 lines) — runs against agent
- `packages/daycare/sources/engine/engine.ts` (~1300 lines of setup) — wires everything
- `packages/daycare/sources/engine/agents/agentSystem.ts` — owns `taskExecutions` getter, `setCrons`

### What we are NOT touching (scope boundary)
- `webhooks.ts` — still calls `agentSystem.taskExecutions.dispatch()` directly (separate PR)
- `task.ts` tool — still calls `toolContext.agentSystem.taskExecutions` (separate PR)
- `startBackgroundWorkflowTool.ts` — still calls `toolContext.agentSystem.taskExecutions` (separate PR)
- `engine.ts` manual task_run — still calls `this.taskExecutions` directly (separate PR)
- No new scheduling logic, queuing, or prioritization

## Development Approach

1. Create a new `scheduler/` module with a `Scheduler` class
2. The Scheduler exposes `dispatch()` and `dispatchAndAwait()` — same interface as TaskExecutions
3. Internally it just forwards to TaskExecutions
4. Update `Crons` to accept `Scheduler` instead of `AgentSystem`
5. Move the `agentPathTask` call and prompt building INTO the Scheduler (so Crons doesn't need to know about agent paths)
6. Wire in `engine.ts`

## Testing Strategy

- All existing tests must pass without modification
- The Scheduler is a pure passthrough — behavior is identical
- Run `yarn jest` to verify nothing breaks
- Specifically: `yarn jest crons` and `yarn jest taskExecution`

## Validation Commands

```bash
cd ~/developer/daycare-platform
git config --global --add safe.directory /home/developer/daycare-platform
yarn jest --no-cache 2>&1 | tail -20
```

## Progress Tracking

- [ ] Task 1: Create Scheduler module
- [ ] Task 2: Update Crons to use Scheduler
- [ ] Task 3: Wire Scheduler in engine.ts

## What Goes Where

| Change | File |
|--------|------|
| New Scheduler class | `packages/daycare/sources/engine/scheduler/scheduler.ts` |
| New Scheduler types | `packages/daycare/sources/engine/scheduler/schedulerTypes.ts` |
| Update Crons options | `packages/daycare/sources/engine/cron/crons.ts` |
| Wire Scheduler | `packages/daycare/sources/engine/engine.ts` |

## Implementation Steps

### Task 1: Create Scheduler module

Create the Scheduler class as a thin passthrough wrapper around TaskExecutions.

Files:
- `packages/daycare/sources/engine/scheduler/scheduler.ts` (new)
- `packages/daycare/sources/engine/scheduler/schedulerTypes.ts` (new)

Verify:
```bash
cd ~/developer/daycare-platform && npx tsc --noEmit 2>&1 | head -20
```

- [ ] Create `packages/daycare/sources/engine/scheduler/schedulerTypes.ts` with `SchedulerDispatchInput` type (re-export or alias `TaskExecutionDispatchInput`)
- [ ] Create `packages/daycare/sources/engine/scheduler/scheduler.ts` with `Scheduler` class
- [ ] Scheduler constructor takes `{ taskExecutions: TaskExecutions }`
- [ ] Scheduler.dispatch(input) forwards to taskExecutions.dispatch(input)
- [ ] Scheduler.dispatchAndAwait(input) forwards to taskExecutions.dispatchAndAwait(input)
- [ ] Verify TypeScript compiles clean

### Task 2: Update Crons to use Scheduler instead of AgentSystem

Replace the `agentSystem` dependency in Crons with `Scheduler`. Move the agent path building and prompt construction so Crons calls `scheduler.dispatch()` directly.

Files:
- `packages/daycare/sources/engine/cron/crons.ts` (modify)

Verify:
```bash
cd ~/developer/daycare-platform && npx tsc --noEmit 2>&1 | head -20 && yarn jest crons 2>&1 | tail -10
```

- [ ] Change `CronsOptions` to accept `scheduler: Scheduler` instead of `agentSystem: AgentSystem`
- [ ] Keep the `agentSystem` reference ONLY for non-dispatch operations (like setCrons callback — check if needed)
- [ ] Update `onTask` callback to call `this.scheduler.dispatch()` instead of `this.agentSystem.taskExecutions.dispatch()`
- [ ] The `agentPathTask` import and prompt building stay in Crons (they don't depend on agentSystem instance)
- [ ] Verify cron tests pass
- [ ] Verify TypeScript compiles clean

### Task 3: Wire Scheduler in engine.ts and remove agentSystem from Crons

Wire the new Scheduler into the engine startup sequence. Create Scheduler after TaskExecutions, pass to Crons.

Files:
- `packages/daycare/sources/engine/engine.ts` (modify)

Verify:
```bash
cd ~/developer/daycare-platform && npx tsc --noEmit 2>&1 | head -20 && yarn jest 2>&1 | tail -20
```

- [ ] Import Scheduler in engine.ts
- [ ] Create `this.scheduler = new Scheduler({ taskExecutions: this.taskExecutions })` after TaskExecutions creation
- [ ] Update Crons construction to pass `scheduler` instead of (or alongside) `agentSystem`
- [ ] Keep `this.agentSystem.setCrons(this.crons)` — that's a separate dependency direction
- [ ] Verify full test suite passes
- [ ] Verify TypeScript compiles clean

## Post-Completion

- [ ] Create PR `refactor/scheduler-decouple` targeting `main`
- [ ] PR description explains the decoupling and scope boundary
- [ ] Follow-up PRs: route webhooks, tools, and manual task_run through Scheduler
