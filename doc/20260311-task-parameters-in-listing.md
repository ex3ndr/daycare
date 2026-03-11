# Task Parameters In Listings

Task parameter schemas are now included in task summary payloads, not only in single-task reads.
That lets clients decide whether a task can be run or configured without first fetching full task
detail.

```mermaid
flowchart TD
    A[core task frontmatter parameters] --> B[TasksRepository]
    B --> C[taskListAll / taskListActive]
    C --> D[/tasks and /tasks/active API responses]
    D --> E[daycare-app task summaries]
    E --> F[run/config UI can detect required inputs]
```

The app task parameter type now matches the backend task schema shape:

- `name`
- `type`
- `nullable`
