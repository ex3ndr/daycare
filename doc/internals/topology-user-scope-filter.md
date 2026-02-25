# Topology User Scope Filter

Topology now filters every section by caller-visible user scope instead of mixing in global runtime data.

```mermaid
flowchart TD
  Caller["caller userId"] --> SubCheck{"caller is subuser?"}
  SubCheck -->|yes| ScopeA["visibleUserIds = [caller]"]
  SubCheck -->|no| ScopeB["visibleUserIds = [caller + owned subusers]"]
  ScopeA --> Filter["filter agents/crons/heartbeats/signals/channels/exposes"]
  ScopeB --> Filter
  Filter --> Output["topology summary + typed counts"]
```

## Scope

- Agent, cron, heartbeat, signal subscription, channel, and expose sections are filtered to `visibleUserIds`.
- Channel filtering now uses leader-or-member agent visibility, so leader-only channels remain visible.
- Expose endpoints are loaded from storage per visible user (`exposeEndpoints.findMany(ctx)`), not from global expose facade state.
- Friend and subuser sections remain available to non-subuser callers.
