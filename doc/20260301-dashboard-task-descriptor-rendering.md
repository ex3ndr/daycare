# Dashboard Task Descriptor Rendering

## Summary

Updated `daycare-dashboard` to render the new agent descriptor type:

- `{ type: "task", id: string }`

The dashboard now shows task agents as `task:<id>` and classifies them under `Task` in type labels and filters.

Also aligned dashboard descriptor parity for `subuser` so those descriptors no longer fall back to `system`.

## Rendering Flow

```mermaid
flowchart TD
    Engine[Engine agent descriptor] --> Switch{descriptor.type}
    Switch -->|task| TaskLabel[Descriptor text: task:id]
    Switch -->|task| TaskType[Agent type: task]
    TaskType --> Filter[Type filter + badge label = Task]
    Switch -->|subuser| SubuserLabel[Descriptor text: subuser:name / id]
    Switch -->|other known type| Existing[Existing formatter path]
    Switch -->|unknown| Fallback[Fallback: system]
```
