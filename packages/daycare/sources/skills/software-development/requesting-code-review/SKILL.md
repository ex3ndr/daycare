---
name: requesting-code-review
description: Use after finishing meaningful code changes. Run a deliberate self-check, then ask a fresh reviewer agent to inspect the work before merge.
---

# Requesting Code Review

Fresh reviewers catch the problems you have already rationalized away.

## When To Use

- After each non-trivial task
- Before merging a feature or bug fix
- After refactors
- After touching auth, data, files, tasks, or permissions

## Self-Review First

Before asking another agent to review:

1. Run the relevant tests, typecheck, and lint.
2. Inspect the diff yourself.
3. Remove debug code and accidental files.
4. Confirm the change matches the original requirement.

## Reviewer Workflow

Preferred pattern:

1. Start a fresh reviewer with `start_background_agent`.
2. Give it the exact requirement, changed files, and review scope.
3. If you need a synchronous answer from a known reviewer, use `agent_ask`.
4. Fix critical issues before moving on.
5. Re-run review after substantive fixes.

## Reviewer Prompt Template

Use a prompt like this:

```text
Review this implementation for correctness and quality.

Requirements:
- ...

Files changed:
- path/to/file-a.ts
- path/to/file-b.spec.ts

Check:
- correctness against requirements
- edge cases and regressions
- security and permission mistakes
- missing tests
- obvious performance issues

Return findings first, ordered by severity, with file paths and line numbers.
If there are no findings, say so and mention residual risks.
```

## Interpretation

- Critical findings: fix now
- Important findings: usually fix before merge
- Minor findings: fix if cheap or note explicitly

If you disagree with a finding, answer with code-level reasoning, not preference.
