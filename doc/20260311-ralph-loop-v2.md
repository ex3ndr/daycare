# Ralph Loop V2

The Ralph loop now covers planning, execution, review, and recursive delegation through built-in
core tasks. The plan format is explicit enough for `core:plan-verify` to reject malformed plans
before any worker starts, and the execution loop now passes plan context plus the remaining task
queue into delegated subagents.

Bundled core tasks in the loop:

- `core:ralph-loop`
- `core:plan-verify`
- `core:plan-execute`
- `core:section-execute-commit`
- `core:review-results`

```mermaid
flowchart TD
    A[core:ralph-loop] --> B[core:plan-verify]
    B -->|valid| C[core:plan-execute]
    B -->|invalid| H[Stop and fix plan format]
    C --> D[Child core:ralph-loop for one task]
    D --> E[Implement, validate, update plan, commit]
    E --> F[core:review-results]
    F -->|pass| G{More tasks?}
    F -->|fail| D
    G -->|yes| D
    G -->|no| I[Summarize commits and follow-ups]
```

Expected plan shape for the loop:

```mermaid
flowchart TD
    A[# Title] --> B[## Overview]
    B --> C[## Context]
    C --> D[## Development Approach]
    D --> E[## Testing Strategy]
    E --> F[## Validation Commands]
    F --> G[## Progress Tracking]
    G --> H[## What Goes Where]
    H --> I[## Implementation Steps]
    I --> J[### Task N with Files, Verify, checkboxes]
    J --> K[## Post-Completion without checkboxes]
```
