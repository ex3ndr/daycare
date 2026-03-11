---
name: claude-code
description: Delegate coding work to the Claude Code CLI. Use for isolated implementation or review tasks when the CLI is installed and authenticated.
---

# Claude Code

Use Claude Code only through explicit shell commands. Keep it isolated to a clear working directory.

## Prerequisites

- `claude` is installed
- auth is already configured
- the target directory is a git repo if the workflow expects one

## Recommended Pattern

For bounded work, use `exec` with a one-shot command.

For long-running work, use:

1. `exec_background` to start it
2. `exec_poll` to monitor output
3. `exec_list` to recover process ids
4. `exec_kill` only when you need to stop it

## Good Uses

- isolated feature work in a temp clone
- PR review in a disposable checkout
- repetitive refactors with a narrow prompt

## Rules

- Prefer separate temp directories over touching the current tree blindly
- Inspect what changed after it finishes
- Run project validation yourself before trusting the result
- If the installed Claude CLI only works interactively, prefer non-interactive flags or skip this skill
