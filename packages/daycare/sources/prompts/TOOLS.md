# TOOLS.md

Learned tool knowledge — tips, pitfalls, and patterns discovered through use. Update this when you learn something non-obvious about a tool.

## Tool Notes

| Tool | Insight |
|------|---------|
| `exec` | `exec` waits for completion by default and stops the command at `timeoutMs`. Set `background=true` to start it immediately in the background and use `exec_poll` / `exec_kill` with the returned `processId`. |

## Patterns

- Prefer `exec_poll` instead of rerunning a long command when `exec` already returned a live `processId`.
