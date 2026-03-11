---
name: codex
description: Delegate coding work to the Codex CLI. Use for isolated implementation, review, or refactor tasks when Codex is installed and the target directory is a git repo.
---

# Codex CLI

Use Codex through explicit shell commands and keep it inside a known git repository.

## Prerequisites

- `codex` is installed
- credentials are configured
- the working directory is a git repo

## Recommended Pattern

- Short task: `exec`
- Long task: `exec_background` then `exec_poll`
- Recovery: `exec_list`
- Stop: `exec_kill`

## Good Uses

- one-shot code generation in a temp repo
- review work in disposable clones
- narrow, well-specified bug fixes

## Rules

- Prefer isolated directories for risky work
- Review the diff yourself after Codex finishes
- Re-run lint, typecheck, and tests yourself
- If the installed Codex CLI requires an interactive mode that does not behave well in `exec`, use a different approach
