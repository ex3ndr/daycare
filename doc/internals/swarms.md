# Swarms internals

Swarms are managed by `sources/engine/swarms/` and discovered from `users` records where `is_swarm = 1`.

## Engine wiring

```mermaid
flowchart LR
    EngineStart[Engine.start] --> Discover[Swarms.discover(ownerUserId)]
    EngineStart --> CreateTool[register swarm_create]
    Swarms --> Mounts[mountsForOwner -> /share/swarm/<nametag>/]
    Mounts --> AgentSystem[AgentSystem.extraMountsForUserId]
```

## Message routing

```mermaid
sequenceDiagram
    participant Tool as send_user_message
    participant Resolver as swarmAgentResolve
    participant Users as users
    participant Contacts as swarm_contacts
    participant AS as AgentSystem

    Tool->>Users: findByNametag(targetNametag)
    Users-->>Tool: target user (is_swarm = 1)
    Tool->>Resolver: resolve(swarmUserId, contactAgentId)
    Resolver->>Contacts: findOrCreate(...)
    Resolver->>AS: agentIdForTarget(descriptor.type = "swarm")
    Resolver-->>Tool: swarmAgentId    
    Tool->>Contacts: recordReceived(...)
    Tool->>AS: post/postAndAwait(system_message)
```

## Storage

- `users`: swarm identity and runtime profile (`is_swarm`, `first_name`, `last_name`, `bio`, `about`, `system_prompt`, `memory`).
- `swarm_contacts`: per-swarm contact map and message counters.
