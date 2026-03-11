# Software Development Workflow

Software development now has a dedicated entry task for raw user requests. The intended flow is no
longer "edit immediately in the foreground agent"; it is "plan first, validate, then delegate
implementation to the Ralph loop."

```mermaid
flowchart TD
    A[User prompt] --> B[core:software-development]
    B --> C[Create or update docs/plans/... plan]
    C --> D[core:plan-verify]
    D -->|valid| E[core:ralph-loop]
    D -->|invalid| C
    E --> F[core:plan-execute]
    F --> G[Subagent per task]
    G --> H[Implement + validate + commit]
    H --> I[core:review-results]
    I -->|pass| J{More tasks?}
    I -->|fail| G
    J -->|yes| G
    J -->|no| K[Foreground summary]
```

Foreground-agent policy:

- create or update the plan first
- never start non-trivial implementation before `core:plan-verify` passes
- use subagents for implementation
- keep commits task-scoped instead of batching the whole feature into one commit
