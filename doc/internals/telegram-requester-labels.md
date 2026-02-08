# Telegram requester labels for cron agents

This note documents how permission requester labels now prefer human-readable cron task names.

```mermaid
sequenceDiagram
  participant C as Cron scheduler
  participant A as AgentSystem
  participant P as request_permission tool
  participant T as Telegram connector
  participant U as User

  C->>A: post(descriptor: { type: "cron", id, name })
  A->>P: execute request_permission
  P->>P: agentDescriptorLabel(descriptor)
  P->>T: request.requester.label = cron task name (or "cron task")
  T-->>U: Permission message with human-readable Requester
```

## Notes
- Cron descriptors may include `name` so labels do not rely on opaque ids.
- `agentDescriptorLabel` now renders cron descriptors as `name` when present.
- Cron fallback label is `cron task` instead of `cron:<id>`.
