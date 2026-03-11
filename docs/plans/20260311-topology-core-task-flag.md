# Add isCore flag to topology task entries

## Overview
Add an `isCore: boolean` field to the topology tool's task entries so agents can distinguish bundled core tasks (like `core:software-development`) from user-created tasks. Currently all tasks look the same in topology output.

## Context
- The topology tool is defined in `packages/daycare/sources/engine/modules/tools/topologyToolBuild.ts`
- Tasks are loaded via `storage.tasks.findMany()` which already includes core tasks (via `taskCoreList`)
- Core task IDs start with `core:` — detected by `taskCoreIdIs()` from `engine/tasks/core/taskCoreIdIs.ts`
- The `topologyTaskSchema` TypeBox schema defines the shape returned to agents
- The internal `TopologyTask` type mirrors the schema
- Tests are in `topologyToolBuild.spec.ts` (353 lines)

## Development Approach
- Add `isCore` to the schema, type, and task entry construction
- Import and use the existing `taskCoreIdIs` helper
- Add a test case with a core task in the mock data

## Testing Strategy
- Run existing topology tests to ensure no regression
- Add a new test that includes a core task (`core:ralph-loop`) in the mock data and verifies `isCore` is true for it and false for user tasks
- Typecheck passes

## Validation Commands
- `yarn test packages/daycare/sources/engine/modules/tools/topologyToolBuild.spec.ts`
- `yarn typecheck`

## Progress Tracking
- [ ] keep task checkboxes updated
- [ ] add follow-up items inline when scope changes

## What Goes Where
- Implementation Steps: checkbox-driven tasks that can be completed in this repo
- Post-Completion: manual follow-up items with no checkboxes

## Implementation Steps

### Task 1: Add isCore to schema, type, and task entry builder
Files:
- `packages/daycare/sources/engine/modules/tools/topologyToolBuild.ts`

Verify:
- `yarn typecheck`

- [ ] Import `taskCoreIdIs` from `../../tasks/core/taskCoreIdIs.js`
- [ ] Add `isCore: Type.Boolean()` to `topologyTaskSchema`
- [ ] Add `isCore: boolean` to the `TopologyTask` type alias
- [ ] Set `isCore: taskCoreIdIs(task.id)` in the task entry construction loop (around line 368)

### Task 2: Add test coverage for isCore field
Files:
- `packages/daycare/sources/engine/modules/tools/topologyToolBuild.spec.ts`

Verify:
- `yarn test packages/daycare/sources/engine/modules/tools/topologyToolBuild.spec.ts`

- [ ] Add a test case that includes a `core:ralph-loop` task in mock `tasksByUser` data
- [ ] Assert `isCore` is `true` for the core task entry
- [ ] Assert `isCore` is `false` for a regular user task entry
- [ ] Verify all existing tests still pass

## Post-Completion
- Update system prompt docs if topology output shape is documented
- Consider adding `isCore` filter option to topology in the future
