---
name: writing-plans
description: Write implementation plans with exact files, validation commands, and bite-sized tasks. Use before multi-step changes or before delegating work to subagents.
---

# Writing Plans

Write plans so the implementer does not need to guess.

## Plan Standard

Every plan should include:

- the goal
- the intended approach
- constraints and assumptions
- exact files to create or modify
- verification commands
- review and commit checkpoints

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

## Suggested Structure

```markdown
# Feature Name

## Goal
- ...

## Approach
- ...

## Tasks
### Task 1: ...
- Files: ...
- Change: ...
- Verify: `...`

### Task 2: ...
...
```

## Planning Rules

1. Use exact repository paths.
2. Name the command that proves the task is done.
3. Call out migrations, generated files, and docs updates explicitly.
4. Add review checkpoints for risky steps.
5. Prefer multiple small tasks over one large paragraph.

## Delegation

If the plan is meant for subagents, each task should be copy-pasteable into a worker prompt with no extra discovery required.
