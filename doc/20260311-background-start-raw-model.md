# Background Start Raw Model Override

## Overview

`start_background_agent` and `start_background_workflow` now accept an optional `model` field.
The value must be a raw provider-native model id for the resolved subagent provider. Flavor values such as
`small`, `normal`, `large`, or custom flavor names are rejected.

## Flow

```mermaid
flowchart TD
    A[start_background_agent/workflow] --> B{model provided?}
    B -- no --> C[Create child agent with normal subagent resolution]
    B -- yes --> D[Resolve subagent provider from active providers plus subagent role rules]
    D --> E{Model id exists in provider catalog?}
    E -- no --> F[Reject tool call]
    E -- yes --> G[Store runtime model override on child agent]
    G --> C
```

## Notes

- Validation is catalog-based and happens before the child receives its first message or workflow task.
- The stored override is a direct raw model id, not a role/flavor selector.
- This keeps `set_agent_model` behavior unchanged while allowing one-off child starts on a specific checked model.
