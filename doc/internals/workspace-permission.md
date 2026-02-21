# Workspace Permission (Removed)

`@workspace` is removed from the runtime permission model.

## Current behavior

- There is no workspace permission tag.
- There is no workspace permission resolver.
- Apps cannot request workspace expansion at runtime.

Access is determined only by each agent's fixed `SessionPermissions` and sandbox policy.

```mermaid
flowchart TD
  A[@workspace tag] --> B[Removed]
  B --> C[No parser]
  B --> D[No grant flow]
  B --> E[No connector prompt]
```

## Replacement

- User agents write within `UserHome.home`.
- App agents write only in `apps/<id>/data`.
