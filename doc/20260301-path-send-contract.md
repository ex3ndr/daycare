# Path Send Contract (Config-First)

This change enforces strict path-target behavior in `AgentSystem` and routes task dispatch through resolved `agentId`.

## Rules

- Path target **without** `creationConfig`: resolve existing active agent only.
- Path target **with** `creationConfig`: resolve existing first, create only if missing.
- Dead agents always throw.
- Task execution resolves path to `agentId` before posting.

## Flow

```mermaid
flowchart TD
    A[post/postAndAwait target] --> B{target has agentId?}
    B -- yes --> C[resolve/restore by id]
    B -- no --> D[path entry resolve]
    D --> E{found active?}
    E -- yes --> F[use resolved agent entry]
    E -- no --> G{creationConfig provided?}
    G -- no --> H[throw Agent not found for path]
    G -- yes --> I[create agent from config.kind]
    C --> J[enqueue item]
    F --> J
    I --> J
```

## Task Dispatch Behavior

```mermaid
sequenceDiagram
    participant T as TaskExecutions
    participant S as AgentSystem
    T->>S: agentIdForTarget(ctx, {path}, creationConfig)
    S-->>T: agentId
    T->>S: postAndAwait(ctx, {agentId}, item, creationConfig)
```
