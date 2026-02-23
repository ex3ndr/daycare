# ctx required + internal user id resolution

## Summary

This change removes internal `Context | string` compatibility shims and requires explicit `Context` across agent and memory operations.

It also fixes descriptor context resolution so user descriptors are mapped from connector identity (`connector:userId`) to the internal users table ID before posting work to `AgentSystem`.

## Key behavior changes

- Internal ops now require `ctx` parameters; raw `agentId` calls were removed.
- `Agent.create` and `Agent.restore` now accept only ctx-based signatures.
- `Memory` methods accept only `ctx`.
- `Engine.descriptorContextResolve` resolves user descriptors via `userConnectorKeyCreate` + `storage.resolveUserByConnectorKey`.
- Resolution errors now preserve original error details via wrapped error cause.

## Flow

```mermaid
sequenceDiagram
    participant Connector
    participant Engine
    participant Storage
    participant AgentSystem

    Connector->>Engine: message/command + descriptor(type=user, connector, userId)
    Engine->>Storage: resolveUserByConnectorKey(connector:userId)
    Storage-->>Engine: internal user record (id=cuid2)
    Engine->>Engine: contextForUser({ userId: internalId })
    Engine->>AgentSystem: post(ctx, target, inboxItem)
```
