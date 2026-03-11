## Fix core task Python bugs and add VM-based unit tests

### Bugs Fixed

**Bug 1: `read()` returns dict, not string** (all 5 task files)
```python
# Before (broken): read() returns {"content": "...", ...}
plan_text = read(path=plan_path_value)
# → TypeError: expected string, not dict

# After (fixed):
plan_text = read(path=plan_path_value)["content"]
```

**Bug 2: `dict[str, object]` typing** (all 5 task files)
```python
# Before: Monty type checker rejects iteration over `object`
def task_entries(...) -> list[dict[str, object]]:

# After:
def task_entries(...) -> list[dict[str, Any]]:
```

**Bug 3: Forward reference in function definitions** (plan-verify)
```python
# Before: Monty VM doesn't support forward references
def task_entries(...):  # calls labeled_items()
    ...
def labeled_items(...):  # defined AFTER caller
    ...

# After: callee defined before caller
def labeled_items(...):
    ...
def task_entries(...):  # now labeled_items is already defined
    ...
```

### Tests

Added `core-tasks.spec.ts` with **8 VM-based tests** that run each core task's Python code through the actual Monty Python VM (`rlmExecute`) with a mocked `read()` tool:

- plan-verify: valid plan, incomplete plan
- ralph-loop: specific task, all complete
- plan-execute: remaining tasks
- section-execute-commit: specific task
- review-results: completed task
- software-development: workflow instructions

```
✓ packages/daycare/sources/core-tasks/core-tasks.spec.ts (8 tests) 775ms
Test Files  1 passed (1)
     Tests  8 passed (8)
```
