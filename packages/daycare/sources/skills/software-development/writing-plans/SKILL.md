---
name: writing-plans
description: Write implementation plans in the Ralph loop format with exact files, validation commands, and bite-sized tasks. Use before multi-step changes or before delegating work to subagents.
---

# Writing Plans

Write plans so the implementer does not need to guess, and so `core:plan-verify` can validate the plan before any worker starts.

## Plan Standard

Every plan must include:

- a single `# Title`
- `## Overview`
- `## Context`
- `## Development Approach`
- `## Testing Strategy`
- `## Validation Commands`
- `## Progress Tracking`
- `## What Goes Where`
- `## Implementation Steps`
- `## Post-Completion`

## Task Granularity

Target 2-5 minute tasks.

Good task:

- one clear outcome
- one small file set
- one verification step

Bad task:

- broad feature chunks
- multiple unrelated edits
- unclear done condition

## Required Output Format

```markdown
# Feature Name

## Overview
- ...

## Context
- ...

## Development Approach
- ...

## Testing Strategy
- ...

## Validation Commands
- `yarn lint`
- `yarn test`

## Progress Tracking
- [ ] keep task checkboxes updated
- [ ] add follow-up items inline when scope changes

## What Goes Where
- Implementation Steps: checkbox-driven tasks that can be completed in this repo
- Post-Completion: manual follow-up items with no checkboxes

## Implementation Steps
### Task 1: ...
Files:
- `path/to/file.ts`

Verify:
- `yarn test path/to/file.spec.ts`

- [ ] ...
- [ ] ...

### Task 2: ...
Files:
- `path/to/other-file.ts`

Verify:
- `yarn typecheck`

- [ ] ...

## Post-Completion
- ...
```

## Task Section Rules

Every `### Task ...` section must include:

- a `Files:` label followed by bullet items with exact repository paths
- a `Verify:` label followed by bullet items with commands or explicit review checks
- one or more checkbox items (`- [ ] ...` or `- [x] ...`)

Preferred task section shape:

```markdown
### Task 1: Add task registry lookup
Files:
- `packages/daycare/sources/storage/tasksRepository.ts`
- `packages/daycare/sources/storage/tasksRepository.spec.ts`

Verify:
- `yarn test packages/daycare/sources/storage/tasksRepository.spec.ts`
- `yarn typecheck`

- [ ] add the repository lookup branch
- [ ] cover the new core task ids in tests
```

## Planning Rules

1. Use exact repository paths in every `Files:` block.
2. Name the command or explicit review check that proves the task is done in every `Verify:` block.
3. Keep `## Validation Commands` repo-wide and `Verify:` task-specific.
4. Call out migrations, generated files, and docs updates explicitly.
5. Add review checkpoints for risky steps.
6. Prefer multiple small tasks over one large paragraph.
7. `## Post-Completion` must not contain checkboxes.

## Delegation

If the plan is meant for subagents, each task should be copy-pasteable into a worker prompt with no extra discovery required. The Ralph loop core tasks assume the plan already contains the exact context, file list, and verification steps each worker needs.
