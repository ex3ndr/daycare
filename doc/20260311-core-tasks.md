# Core Tasks

Core tasks are bundled with the repo and resolved from files instead of the `tasks` table.
They use the reserved `core:<name>` namespace, are always exposed as version `1`, and cannot be
updated or deleted through task APIs.

The bundled orchestration set is now:

- `core:ralph-loop`
- `core:plan-verify`
- `core:plan-execute`
- `core:section-execute-commit`
- `core:review-results`

`core:ralph-loop` is the top-level entrypoint. It validates the plan format, delegates execution to
the plan runner, and uses child Ralph loops plus review tasks to work through the remaining task
queue.

```mermaid
flowchart TD
    A[Task lookup: core:ralph-loop] --> B[TasksRepository]
    B --> C[core-tasks/*/description.md]
    B --> D[core-tasks/*/task.py]
    C --> E[Virtual TaskDbRecord v1]
    D --> E
    E --> F[task_read / task_run / cron / webhook]
    F --> G[core:plan-verify]
    G --> H[core:plan-execute]
    H --> I[child core:ralph-loop]
    I --> J[core:review-results]
```
