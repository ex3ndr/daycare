# Cron Human-Readable Schedule and Next Run

## Summary
- Added `cronScheduleDescribe()` to convert a 5-field cron expression into readable text.
- Added next-run projection fields:
  - `nextRunAt` (unix ms)
  - `nextRunText` (formatted timestamp + relative delta)
- Wired these fields into engine IPC cron payloads:
  - `GET /v1/engine/cron/tasks`
  - SSE init payload `cron` data in `GET /v1/engine/events`
- Updated dashboard rendering to prefer readable schedule text and show next expected run.

## Data Flow
```mermaid
flowchart LR
  A[Scheduled Cron Task] --> B[cronScheduleDescribe]
  B --> C[description]
  B --> D[nextRunAt unix ms]
  B --> E[nextRunText]
  C --> F[/v1/engine/cron/tasks response]
  D --> F
  E --> F
  F --> G[Dashboard cron list]
```
