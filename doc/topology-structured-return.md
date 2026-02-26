# Topology Structured Return

## Summary

The `topology` tool now returns a structured object as `typedResult` instead of a human-formatted section string.

The result is task-centric:

- `tasks[]` is the primary scheduling view.
- Each task contains nested `triggers.cron[]` and `triggers.heartbeat[]`.
- Internal memory agents and `dead` lifecycle agents are excluded by default.

## Data Shape

```mermaid
flowchart TD
    Topology["topology typedResult"] --> Agents["agents[]"]
    Topology --> Tasks["tasks[]"]
    Topology --> Signals["signalSubscriptions[]"]
    Topology --> Channels["channels[]"]
    Topology --> Exposes["exposes[]"]
    Topology --> Subusers["subusers[]"]
    Topology --> Friends["friends[]"]

    Tasks --> Cron["triggers.cron[]"]
    Tasks --> Heartbeat["triggers.heartbeat[]"]

    Cron --> CronMeta["schedule, enabled, agentId, isYou"]
    Heartbeat --> HbMeta["title, lastRunAt"]
```

## Notes

- `toolMessage.content` contains JSON text for compatibility, but the canonical payload is the structured `typedResult` object.
- Topology enforces task/trigger integrity: if a trigger references a missing task in caller scope, the tool fails.
