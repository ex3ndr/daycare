# Remove Exec Gates

## Overview
- Remove the "exec gate" concept entirely from the codebase
- Gates were conditional shell-command filters that decided whether cron/heartbeat tasks should run (exit 0 = proceed, non-zero = skip)
- With gates removed, cron and heartbeat tasks always execute when scheduled
- Add a migration to drop the `gate` column from both DB tables

## Context
- Core gate files: `engine/scheduling/execGate*.ts` (4 impl + 2 test files)
- Consumers: `cronScheduler.ts`, `heartbeatScheduler.ts`, cron/heartbeat tools, repositories, migrations
- Dashboard: `engine-client.ts` types, `automations/page.tsx` UI
- Docs: cron and heartbeat READMEs and concept docs
- Sandbox infrastructure is NOT gate-specific and stays

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Implementation Steps

### Task 1: Delete core gate implementation files
- [x] Delete `sources/engine/scheduling/execGateTypes.ts`
- [x] Delete `sources/engine/scheduling/execGateCheck.ts`
- [x] Delete `sources/engine/scheduling/execGateNormalize.ts`
- [x] Delete `sources/engine/scheduling/execGateOutputAppend.ts`
- [x] Delete `sources/engine/scheduling/execGateNormalize.spec.ts`
- [x] Delete `sources/engine/scheduling/execGateOutputAppend.spec.ts`
- [x] Remove `ExecGateDefinition` re-export from `sources/types.ts`
- [x] Run `yarn typecheck` to identify all downstream breakages (expected)

### Task 2: Strip gates from cron types and scheduler
- [x] Remove `gate?: ExecGateDefinition` from `CronTaskDefinition` in `engine/cron/cronTypes.ts`
- [x] Remove unused `ExecGateDefinition` import from `cronTypes.ts`
- [x] In `cronScheduler.ts`: remove gate imports (`execGateCheck`, `execGateOutputAppend`)
- [x] In `cronScheduler.ts`: remove `gateCheck` from `CronSchedulerOptions`
- [x] In `cronScheduler.ts`: remove `private gateCheck` field and its constructor init
- [x] In `cronScheduler.ts`: remove `checkGate()` method entirely
- [x] In `cronScheduler.ts`: simplify `executeTaskUnlocked()` — remove gate check call, use `task.prompt` directly
- [x] In `cronScheduler.ts`: remove `gate` field from task object construction
- [x] Update `cronScheduler.spec.ts`: remove gate-related test cases and `gateCheck` mock usage
- [x] Run tests — must pass before next task

### Task 3: Strip gates from heartbeat types and scheduler
- [x] Remove gate-related imports from `heartbeatTypes.ts` (`ExecGateCheckInput`, `ExecGateCheckResult`)
- [x] Remove `gateCheck` from `HeartbeatSchedulerOptions` in `heartbeatTypes.ts`
- [x] Remove `gate` from `HeartbeatCreateTaskArgs` in `heartbeatTypes.ts`
- [x] Remove `gate` from `HeartbeatDefinition` in `heartbeatTypes.ts` (if present)
- [x] In `heartbeatScheduler.ts`: remove gate imports (`execGateCheck`, `execGateOutputAppend`)
- [x] In `heartbeatScheduler.ts`: remove `private gateCheck` field and its constructor init
- [x] In `heartbeatScheduler.ts`: remove `filterByGate()` method entirely
- [x] In `heartbeatScheduler.ts`: replace `filterByGate()` call with direct task list usage
- [x] In `heartbeatScheduler.ts`: remove `gate` field from task object construction
- [x] Update `heartbeatScheduler.spec.ts`: remove gate-related test cases
- [x] Run tests — must pass before next task

### Task 4: Strip gates from cron and heartbeat tools
- [x] In `engine/modules/tools/cron.ts`: remove `execGateNormalize` import
- [x] In `engine/modules/tools/cron.ts`: remove `gate` schema from `addCronSchema` TypeBox object
- [x] In `engine/modules/tools/cron.ts`: remove gate normalization and gate field from task creation/return
- [x] In `engine/modules/tools/heartbeat.ts`: remove `execGateNormalize` import
- [x] In `engine/modules/tools/heartbeat.ts`: remove `gate` schema from `addSchema` TypeBox object
- [x] In `engine/modules/tools/heartbeat.ts`: remove gate normalization and gate field from task creation/return
- [x] Run tests — must pass before next task

### Task 5: Strip gates from storage layer
- [x] In `storage/databaseTypes.ts`: remove `ExecGateDefinition` import
- [x] In `storage/databaseTypes.ts`: remove `gate` field from `DatabaseCronTaskRow` and `CronTaskDbRecord`
- [x] In `storage/databaseTypes.ts`: remove `gate` field from `DatabaseHeartbeatTaskRow` and `HeartbeatTaskDbRecord`
- [x] In `storage/cronTasksRepository.ts`: remove `gateParse()` helper
- [x] In `storage/cronTasksRepository.ts`: remove all `gate` column references from SQL and serialization
- [x] In `storage/heartbeatTasksRepository.ts`: remove `gateParse()` helper
- [x] In `storage/heartbeatTasksRepository.ts`: remove all `gate` column references from SQL and serialization
- [x] In `storage/migrations/20260220_import_tasks.ts`: remove `execGateNormalize` import and gate handling from YAML parsing
- [x] Update `storage/migrations/20260220_import_tasks.spec.ts` if it tests gate normalization
- [x] Run tests — must pass before next task

### Task 6: Add migration to drop gate columns
- [x] Create `storage/migrations/20260221_drop_gate_columns.ts`
- [x] `ALTER TABLE tasks_cron DROP COLUMN gate`
- [x] `ALTER TABLE tasks_heartbeat DROP COLUMN gate`
- [x] Remove `gate TEXT` from the create-table DDL in `20260220_add_tasks.ts` (so fresh installs don't create the column only to drop it)
- [x] Run tests — must pass before next task

### Task 7: Update dashboard
- [x] In `packages/daycare-dashboard/lib/engine-client.ts`: remove `ExecGate` type and `gate` fields from `CronTask` / `HeartbeatTask`
- [x] In `packages/daycare-dashboard/app/automations/page.tsx`: remove gated task count and any gate UI references
- [x] Run `yarn typecheck` to confirm no remaining dashboard breakages

### Task 8: Update documentation
- [x] Update `engine/cron/README.md`: remove gate column from schema, simplify mermaid diagram
- [x] Update `engine/heartbeat/README.md`: remove gate column from schema, simplify mermaid diagram
- [x] Update `doc/concepts/cron.md`: remove "Exec gate" section and gate YAML examples
- [x] Update `doc/concepts/heartbeats.md`: remove "Exec gate" section and gate YAML examples
- [x] Update or delete `doc/internals/auto-gate-permission-request.md` (now irrelevant)
- [x] Delete `docs/plans/auto-gate-permission-request.md` (obsolete plan)
- [x] Update scheduling prompt/skill docs under `sources/prompts/` and `sources/skills/` to remove gate guidance

### Task 9: Verify acceptance criteria
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run typecheck (`yarn typecheck`)
- [x] Grep codebase for remaining "gate" / "Gate" references to ensure nothing was missed
- [x] Verify no `ExecGate` type remains anywhere

## Technical Details
- **DB migration**: SQLite supports `ALTER TABLE ... DROP COLUMN` since 3.35.0 (2021); Node 22 bundles a recent enough SQLite
- **No backward compat**: gates are removed entirely; existing tasks with gates lose that functionality silently
- **Sandbox stays**: the sandbox execution infra (`sandbox*.ts`) is used by other systems and is untouched

## Post-Completion
- Existing cron/heartbeat task files with `gate:` frontmatter will have that field ignored on import
- No external system changes needed — gates were internal-only
