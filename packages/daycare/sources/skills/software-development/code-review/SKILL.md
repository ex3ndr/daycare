---
name: code-review
description: Review code changes for correctness, regressions, security risks, and missing tests. Use whenever the user asks for a review or before merging non-trivial work.
---

# Code Review

Treat review as bug-finding, not prose generation.

## Priorities

Check these first:

1. Correctness and behavior regressions
2. Security and permission mistakes
3. Data loss, migration, and state corruption risks
4. Missing or weak test coverage
5. Performance issues that are obvious from the diff

## Review Workflow

1. Read the requirements or task description first.
2. Inspect the diff and the touched files, not just the final code.
3. Compare implementation against nearby patterns in the codebase.
4. Verify tests cover the changed behavior and likely edge cases.
5. Flag only concrete issues you can defend from the code.

## Response Format

Always lead with findings. Keep them ordered by severity.

```markdown
1. High: [short title] — [why it is wrong]
File: /absolute/path/to/file.ts:123

2. Medium: [short title] — [risk or missing case]
File: /absolute/path/to/file.ts:45

Open questions:
- [only if intent is unclear]
```

Rules:

- Cite exact file paths and lines when possible.
- Explain the failure mode, not just the smell.
- Suggest the smallest credible fix.
- If there are no findings, say so explicitly and mention residual test gaps.

## Things Worth Flagging

- Wrong conditionals, off-by-one logic, stale assumptions
- Missing auth, permission, or ownership checks
- New APIs without tests
- Path handling that can escape an expected root
- Silent error swallowing on external I/O
- Schema changes without migration or compatibility handling
- Concurrency issues, duplicate side effects, non-idempotent retries
