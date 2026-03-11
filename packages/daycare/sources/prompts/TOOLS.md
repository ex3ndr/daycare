# TOOLS.md

Learned tool knowledge — tips, pitfalls, and patterns discovered through use. Update this when you learn something non-obvious about a tool.

## Tool Notes

| Tool | Insight |
|------|---------|
| `exec` | When `exec` times out it can keep the process alive and return a `processId`; use `exec_poll` for additional output and `exec_kill` to stop it. Set `detachOnTimeout=false` only when you explicitly want timeout to stop the command. |

## Patterns

- Prefer `exec_poll` instead of rerunning a long command when `exec` already returned a live `processId`.
