# Ralph Loop V2

The Ralph loop now covers planning, execution, review, and recursive delegation through built-in
core tasks. The plan format is explicit enough for `core:plan-verify` to reject malformed plans
before any worker starts, and the execution loop now passes plan context plus the remaining task
queue into delegated subagents.

Bundled core tasks in the loop:

- `core:software-development`
- `core:ralph-loop`
- `core:plan-verify`
- `core:plan-execute`
- `core:section-execute-commit`
- `core:review-results`

```mermaid
flowchart TD
    A[core:software-development] --> B[Create or update plan file]
    B --> C[core:plan-verify]
    C -->|valid| D[core:ralph-loop]
    C -->|invalid| J[Fix plan format]
    D --> E[core:plan-execute]
    E --> F[Child core:ralph-loop for one task]
    F --> G[Implement, validate, update plan, commit]
    G --> H[core:review-results]
    H -->|pass| I{More tasks?}
    H -->|fail| F
    I -->|yes| F
    I -->|no| K[Summarize commits and follow-ups]
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
