# Fix core task Python code and add unit tests

## Overview

Fix all 5 core task Python files that have a `read()` return-type bug (`read()` returns a dict with a `content` key, but the code treats it as a string). Also fix the `dict[str, object]` typing in `task_entries()` that causes iteration errors. Add TypeScript unit tests that exercise each core task's Python code through the RLM executor to prevent regressions.

## Context

**Repository:** `~/developer/daycare-platform/`  
**Branch:** `fix/core-tasks-python-bugs` (from `main`)  
**Language:** Python (task code), TypeScript (tests)  
**Build/Test:** `yarn jest` (use `--cache-folder ~/tmp/yarn-cache`)

### Bug 1: `read()` returns dict, not string
All 5 core tasks that read plan files use:
```python
plan_text = read(path=plan_path_value)
```
But `read()` returns `{"content": "...", "path": "...", ...}`. Must be:
```python
plan_text = read(path=plan_path_value)["content"]
```

Affected files:
- `packages/daycare/sources/core-tasks/plan-verify/task.py` (line ~100)
- `packages/daycare/sources/core-tasks/ralph-loop/task.py` (line ~104)
- `packages/daycare/sources/core-tasks/plan-execute/task.py` (line ~40)
- `packages/daycare/sources/core-tasks/review-results/task.py` (line ~113)
- `packages/daycare/sources/core-tasks/section-execute-commit/task.py` (line ~119)

### Bug 2: `dict[str, object]` typing in `task_entries()`
`task_entries()` returns `list[dict[str, object]]` but later code iterates over values as `list[str]` and uses them as `str`. The Monty runtime type checker rejects this.

Affected files:
- `packages/daycare/sources/core-tasks/ralph-loop/task.py`
- `packages/daycare/sources/core-tasks/plan-execute/task.py`
- `packages/daycare/sources/core-tasks/section-execute-commit/task.py`
- `packages/daycare/sources/core-tasks/review-results/task.py`
- `packages/daycare/sources/core-tasks/plan-verify/task.py`

Fix: Change return type to `list[dict[str, Any]]` (using `from typing import Any`).

### How core tasks work
Core tasks are Python files in `packages/daycare/sources/core-tasks/<name>/task.py` loaded by `taskCoreResolve.ts`. They run inside the Monty Python VM (RLM) with access to tool functions like `read()`, `write()`, `exec()`, etc. Parameters declared in `description.md` are injected as bare variables.

## Development Approach

1. Fix the `read()` bug in all 5 task files — add `["content"]`
2. Fix the `dict[str, object]` → `dict[str, Any]` typing in all files that use `task_entries()`
3. Add a single test file that validates each core task's Python code can be parsed and the helper functions work correctly

## Testing Strategy

- Add `packages/daycare/sources/core-tasks/core-tasks.spec.ts` that:
  - Reads each task.py file
  - Verifies the `read(...)["content"]` pattern is used (not bare `read(...)`)
  - Tests the shared helper functions (section_body, task_entries, etc.) by running them through the RLM or by regex validation
  - Tests that plan-verify correctly validates a sample plan
- Run existing test suite to ensure no regressions

## Validation Commands

- `cd ~/developer/daycare-platform && npx tsc --noEmit 2>&1 | head -20`
- `cd ~/developer/daycare-platform && yarn jest core-tasks 2>&1 | tail -20`
- `cd ~/developer/daycare-platform && yarn jest --no-cache 2>&1 | tail -20`

## Progress Tracking

- [ ] Task 1: Fix read() bug in all 5 core task files
- [ ] Task 2: Fix dict typing in all core task files  
- [ ] Task 3: Add unit tests for core tasks

## What Goes Where

| Change | File |
|--------|------|
| Fix read() + typing | `packages/daycare/sources/core-tasks/plan-verify/task.py` |
| Fix read() + typing | `packages/daycare/sources/core-tasks/ralph-loop/task.py` |
| Fix read() + typing | `packages/daycare/sources/core-tasks/plan-execute/task.py` |
| Fix read() + typing | `packages/daycare/sources/core-tasks/review-results/task.py` |
| Fix read() + typing | `packages/daycare/sources/core-tasks/section-execute-commit/task.py` |
| New test file | `packages/daycare/sources/core-tasks/core-tasks.spec.ts` |

## Implementation Steps

### Task 1: Fix read() bug and dict typing in all 5 core task files

Fix `read(path=...)` → `read(path=...)["content"]` and `dict[str, object]` → `dict[str, Any]` in all core task Python files.

Files:
- `packages/daycare/sources/core-tasks/plan-verify/task.py`
- `packages/daycare/sources/core-tasks/ralph-loop/task.py`
- `packages/daycare/sources/core-tasks/plan-execute/task.py`
- `packages/daycare/sources/core-tasks/review-results/task.py`
- `packages/daycare/sources/core-tasks/section-execute-commit/task.py`

Verify:
- `grep -n 'read(path=' packages/daycare/sources/core-tasks/*/task.py | grep -v content`
- `grep -n 'dict\[str, object\]' packages/daycare/sources/core-tasks/*/task.py`

- [ ] Add `from typing import Any` import to all 5 task files that use `task_entries()`
- [ ] Change `plan_text = read(path=plan_path_value)` to `plan_text = read(path=plan_path_value)["content"]` in all 5 files
- [ ] Change `list[dict[str, object]]` to `list[dict[str, Any]]` in all files that have `task_entries()`
- [ ] Verify no bare `read(path=` calls remain (all should have `["content"]`)

### Task 2: Add unit tests for core tasks

Create a test file that validates the Python code in each core task is syntactically correct and uses the right patterns.

Files:
- `packages/daycare/sources/core-tasks/core-tasks.spec.ts` (new)

Verify:
- `cd ~/developer/daycare-platform && yarn jest core-tasks 2>&1 | tail -20`

- [ ] Create test file that reads all task.py files
- [ ] Test that every task.py that calls `read(path=` uses `["content"]` 
- [ ] Test that no task.py uses `dict[str, object]` return type
- [ ] Test that plan-verify helper functions (section_body, task_entries, etc.) work with sample input
- [ ] Test that each description.md has valid frontmatter with title and parameters

## Post-Completion

- Create PR `fix/core-tasks-python-bugs` targeting `main`
- PR description explains both bugs and the testing approach
- Follow-up: consider extracting shared helper functions into a common module
