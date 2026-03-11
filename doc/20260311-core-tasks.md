# Core Tasks

Core tasks are bundled with the repo and resolved from files instead of the `tasks` table.
They use the reserved `core:<name>` namespace, are always exposed as version `1`, and cannot be
updated or deleted through task APIs.

The first bundled task is `core:ralph-loop`, a file-backed task modeled on ralphex's task
execution phase. It reads a markdown plan, picks the first incomplete `Task` or `Iteration`
section, carries forward validation commands, and hands a one-section-only execution prompt to the
task agent.

```mermaid
flowchart TD
    A[Task lookup: core:ralph-loop] --> B[TasksRepository]
    B --> C[core-tasks/ralph-loop/description.md]
    B --> D[core-tasks/ralph-loop/task.py]
    C --> E[Virtual TaskDbRecord v1]
    D --> E
    E --> F[task_read / task_run / cron / webhook]
    F --> G[Task agent receives one-section prompt]
```
