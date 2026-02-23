# Friends System

The Friends system adds three user tools:
- `friend_add(usertag)`
- `friend_remove(usertag)`
- `friend_send(usertag, message)`

It is built on:
- `users.usertag` (unique, nullable for legacy records)
- `connections` table with one canonical row per user pair (`user_a_id < user_b_id`)
- `AgentSystem.postToUserAgents()` for cross-user frontend delivery

## Data model

```mermaid
erDiagram
    users ||--o{ connections : "user_a_id"
    users ||--o{ connections : "user_b_id"

    users {
        text id PK
        integer is_owner
        text parent_user_id
        text name
        text usertag "unique when not null"
        integer created_at
        integer updated_at
    }

    connections {
        text user_a_id PK
        text user_b_id PK
        integer requested_a
        integer requested_b
        integer requested_a_at
        integer requested_b_at
    }
```

## Friend request flow

```mermaid
sequenceDiagram
    participant A as User A agent
    participant S as Daycare runtime
    participant B as User B agent

    A->>S: friend_add("swift-fox-42")
    S->>S: upsert requester side
    S->>B: system_message friend request
    B->>S: friend_add("happy-penguin-42")
    S->>S: upsert reciprocal side (friends)
    S->>A: system_message acceptance
```

## Relationship states

```mermaid
stateDiagram-v2
    [*] --> None
    None --> PendingOut: friend_add(me -> other)
    None --> PendingIn: friend_add(other -> me)
    PendingOut --> Friends: friend_add(other -> me)
    PendingIn --> Friends: friend_add(me -> other)
    PendingIn --> None: friend_remove(reject)
    PendingOut --> None: friend_remove(cancel)
    Friends --> PendingIn: friend_remove(unfriend)
```

## Messaging behavior

- Friend notifications are delivered as `<system_message origin="friend:<usertag>">...`.
- `friend_send` requires both request flags set (`requested_a = 1` and `requested_b = 1`).
- Payload text in friend messages is XML-escaped before embedding in the system message body.
