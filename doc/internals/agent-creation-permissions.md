# Agent Creation Permissions

Creation-time permission pre-grants are removed.

## Current tool behavior

- `start_background_agent` no longer accepts a `permissions` argument.
- `create_permanent_agent` no longer accepts a `permissions` argument.
- New agents start with fixed base permissions for their type.

```mermaid
flowchart TD
  Create[create/start tool] --> Base[Base permissions only]
  Base --> Start[Agent starts]
  OldPreGrant[permissions[] pre-grants] --> Removed[Removed]
```

## Result

Agent creation is simpler and deterministic:

- no tag parsing
- no permission ownership checks
- no grant replay during creation
