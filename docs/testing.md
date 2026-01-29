# Testing

Tests live alongside sources and use `*.spec.ts`.

Current coverage:
- `cron.spec.ts` verifies cron scheduler dispatch and actions.
- `sessions/manager.spec.ts` verifies per-session sequencing.

```mermaid
flowchart TD
  Tests --> CronSpec[cron.spec.ts]
  Tests --> SessionSpec[manager.spec.ts]
```
