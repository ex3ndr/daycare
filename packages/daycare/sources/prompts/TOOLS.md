# TOOLS.md

Learned tool knowledge — tips, pitfalls, and patterns discovered through use. Update this when you learn something non-obvious about a tool.

## Tool Notes

| Tool | Insight |
|------|---------|
| `exec` | `exec` waits for completion by default and stops the command at `timeoutMs`. Use `exec_background` when you want a long-running command and plan to follow it with `exec_poll` / `exec_kill`. |

## Patterns

- Prefer `exec_poll` instead of rerunning a long command when `exec_background` already returned a live `processId`.
- Use `exec_list` if you need to recover the active `processId`s for the current session before polling or killing.
