# Context-Required Routing and Scope Checks

This update finalizes strict context (`ctx`) usage for cross-agent operations and tool execution paths.

## Rules
- `ctx` is required for tool execution and agent routing (`post`, `postAndAwait`, `agentIdForTarget`, `agentFor`, `steer`).
- User identity comes from `ctx.userId`; no owner fallback is allowed.
- Empty `userId` is rejected; unresolved user identity throws.
- Cross-agent operations verify user scope using `ctx.userId`.

## Main Flow

```mermaid
flowchart TD
    A[Tool Execution Context] --> B[ctx: Context required]
    B --> C[AgentSystem.post / postAndAwait]
    C --> D[Resolve target agent context]
    D --> E{ctx.userId == target.userId?}
    E -- yes --> F[Deliver message or action]
    E -- no --> G[Throw scope error]
```

## Signal Subscription Validation

```mermaid
flowchart TD
    A[subscribe/unsubscribe input] --> B[read ctx.userId]
    B --> C{userId non-empty?}
    C -- no --> X[throw userId required]
    C -- yes --> D[read ctx.agentId]
    D --> E{agentId non-empty?}
    E -- no --> Y[throw agentId required]
    E -- yes --> F[normalize pattern and persist]
```

