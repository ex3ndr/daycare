# Agent Signal Feedback Guard

## Summary

Signals emitted with `source={ type: "agent", id: <agentId> }` are no longer delivered to subscriptions owned by the same `<agentId>`.

This prevents self-feedback loops when agents subscribe to patterns that may match their own emitted signals.

Lifecycle signals (`agent:<id>:wake`, `agent:<id>:sleep`, `agent:<id>:idle`) now use agent source (`type=agent`, `id=<agentId>`).

## Delivery Flow

```mermaid
sequenceDiagram
  participant A as Source Agent (id=A)
  participant S as Signals
  participant SYS as AgentSystem
  participant B as Peer Agent (id=B)

  A->>S: generate signal (source=agent:A)
  S->>SYS: deliver(signal, subscriptions)
  SYS->>SYS: skip subscription where subscription.agentId == signal.source.id
  SYS-->>A: no delivery
  SYS-->>B: deliver when pattern matches
```
