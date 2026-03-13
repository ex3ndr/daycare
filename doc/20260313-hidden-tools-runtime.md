# Hidden Tools Runtime Access

Fixed the Python runtime so hidden-by-default tools remain executable for agents and sandboxed skills even when they are omitted from the default prompt.

```mermaid
flowchart TD
    A[Tool marked hiddenByDefault] --> B[Omitted from default prompt rendering]
    B --> C[Skill may document it]
    A --> D[Executable tool listing keeps it available]
    D --> E[run_python preamble includes callable stub]
    E --> F[Sandboxed skill agent can call the real tool]
```

## Changes

- Added a separate execution-time tool listing path that ignores `hiddenByDefault`.
- Kept `visibleByDefault` checks for contextual restrictions such as foreground-only tools.
- Switched Python runtime tool resolution and `run_python` block preambles to use the execution-time list.
