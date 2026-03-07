# Trigger Delete Keeps Task

## Summary

Deleting the last cron or webhook trigger no longer soft-deletes the task.

- Tasks remain valid without any trigger.
- Trigger deletion now affects only the trigger record.
- Added facade-level regression tests for cron and webhook deletion.

## Trigger Removal Flow

```mermaid
flowchart TD
    A[Remove cron or webhook trigger] --> B[Delete trigger record]
    B --> C[Emit trigger-deleted observation]
    C --> D[Keep task record unchanged]
```

## Task Lifecycle

```mermaid
flowchart TD
    A[Create task] --> B[Task exists with zero triggers]
    B --> C[Add cron/webhook trigger]
    C --> D[Task exists with triggers]
    D --> E[Remove last trigger]
    E --> F[Task still exists with zero triggers]
    F --> G[Explicit task delete]
    G --> H[Soft delete task via valid_to]
```
