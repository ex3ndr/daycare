# Foreground Agent Selection Priority (2026-03-01)

## Summary

`most-recent-foreground` selection now prefers true user-facing agents only.

- Foreground candidates: `user`, `swarm`
- Non-foreground candidates (excluded): `permanent`, `task`, `cron`, `subagent`, memory agents
- Telegram `user` agents are explicitly prioritized using a prefixed priority key.
- Within the same priority bucket, selection prefers active lifecycle state, then newest `updatedAt`.

## Why

The previous fallback included non-user-facing agents and could select background/permanent workers.
This update makes default delivery target selection align with actual user-facing conversations.

## Selection Flow

```mermaid
flowchart TD
    A["Loaded agents for ctx.userId"] --> B["Filter to descriptor types: user or swarm"]
    B --> C["Assign priority prefix"]
    C --> C1["aa-telegram (user.connector=telegram)"]
    C --> C2["bb-user (other user connectors)"]
    C --> C3["cc-swarm"]
    C1 --> D["Sort by prefix asc"]
    C2 --> D
    C3 --> D
    D --> E["Sort by lifecycle rank: active < sleeping < dead"]
    E --> F["Sort by updatedAt desc"]
    F --> G["Pick first agentId"]
```
