# Swarms

Swarms are user-scoped agents owned by another user.

## What a swarm is

- A swarm is a `users` row with `is_swarm = 1` and `parent_user_id = <ownerUserId>`.
- Owners create swarms with `swarm_create`.
- Agents talk to swarms through `send_user_message({ nametag, text, wait? })`.
- Each swarm resolves to a persistent swarm-side agent id per contact.

## Data model

```mermaid
erDiagram
    users ||--o{ swarm_contacts : "swarm_user_id"

    users {
        text id PK
        text parent_user_id
        text nametag
        integer is_owner
        integer is_swarm
        text first_name
        text last_name
        text bio
        text about
        text system_prompt
        integer memory
    }

    swarm_contacts {
        text swarm_user_id PK
        text contact_agent_id PK
        text swarm_agent_id
        integer messages_sent
        integer messages_received
        integer first_contact_at
        integer last_contact_at
    }
```

## Message flow

```mermaid
sequenceDiagram
    participant C as Caller agent
    participant T as send_user_message
    participant R as swarmAgentResolve
    participant S as Swarm agent
    participant SC as swarm_contacts

    C->>T: send_user_message({ nametag, text, wait? })
    T->>R: resolve/create swarm agent for (swarm, callerAgentId)
    T->>SC: recordReceived(swarmUserId, callerAgentId)
    alt wait=true
        T->>S: postAndAwait(system_message)
        S-->>T: response
        T-->>C: response + swarmAgentId
    else wait omitted/false
        T->>S: post(system_message)
        T-->>C: ack + swarmAgentId
    end
```

## Proactive messaging boundary

Swarms can call `send_agent_message`:

- Same-user targets are allowed.
- Cross-user targets must exist in `swarm_contacts`.
- Unknown cross-user targets are rejected with:
  `Can only message agents that have contacted this swarm`.

## Filesystem and memory

- Swarm home is created at `<usersDir>/<swarmUserId>/home/`.
- `SOUL.md` is seeded from `users.system_prompt`.
- Memory is opt-in via `users.memory` (default `false`).
- Owner sandboxes mount each swarm home at `/share/swarm/<nametag>/`.
