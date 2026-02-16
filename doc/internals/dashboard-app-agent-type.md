# Dashboard app agent type support

## Summary
The dashboard now treats `descriptor.type: "app"` as a first-class agent type.

- `engine-client` accepts app descriptors from `/v1/engine/agents`.
- `buildAgentType` maps app descriptors to an explicit `AgentType` variant.
- Agents list, agent detail, and dashboard table render app descriptors and labels as `App`.

## Flow
```mermaid
flowchart LR
  A[Engine /v1/engine/agents response\ndescriptor.type = app] --> B[dashboard/lib/engine-client.ts\nAgentDescriptor includes app]
  B --> C[dashboard/lib/agent-types.ts\nbuildAgentType returns type=app]
  C --> D[Agents page\nType filter + label = App]
  C --> E[Agent detail page\nType label = App]
  C --> F[Main dashboard table\nType label = App]
```
