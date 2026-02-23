# Friends System

The Friends system adds three user tools:
- `friend_add(usertag)`
- `friend_remove(usertag)`
- `friend_send(usertag, message)`
- `friend_share_subuser(friendUsertag, subuserId)`
- `friend_unshare_subuser(friendUsertag, subuserId)`

It is built on:
- `users.usertag` (required, unique)
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
        text usertag "required, unique"
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

## Subuser sharing

Owners can share subusers with existing friends by reusing the same `connections` table.
A share is represented by a connection row between `subuser_id` and `friend_id`.

- Pending share: subuser side requested (`requested_subuser = 1`, friend side `0`)
- Active share: both sides requested (`1/1`)
- Acceptance: friend runs `friend_add("<subuser-usertag>")`
- Removal/reject: friend runs `friend_remove("<subuser-usertag>")`
- Owner revoke: `friend_unshare_subuser(...)`

```mermaid
sequenceDiagram
    participant O as Owner
    participant S as Daycare runtime
    participant F as Friend

    O->>S: friend_share_subuser("friend-tag", subuserId)
    S->>S: Verify owner owns subuser
    S->>S: Verify owner and friend are friends
    S->>S: Upsert subuser->friend request
    S->>F: system_message share offer
    F->>S: friend_add("subuser-usertag")
    S->>S: Verify friend and owner are friends
    S->>S: Verify pending subuser offer exists
    S->>S: Upsert friend side (share active)
    S->>O: system_message accepted access
```

```mermaid
sequenceDiagram
    participant O as Owner
    participant S as Daycare runtime
    participant F as Friend

    O->>S: friend_unshare_subuser("friend-tag", subuserId)
    S->>S: Clear subuser side request
    S->>F: system_message revoked access

    F->>S: friend_remove("subuser-usertag")
    S->>S: Clear friend side (active) or clear subuser side (pending reject)
    S->>O: system_message removed access (active case)
```

## Shared subuser messaging and topology

- `friend_send("<subuser-usertag>", message)` delivers to the shared subuser gateway agent when share is active.
- Topology for non-subuser callers now includes:
  - `## Friends (N)`
  - per-friend tree items:
    - `→ shared out` for caller-owned subusers shared to that friend
    - `← shared in` for that friend's subusers shared to caller
    - `status=active|pending` and gateway agent id
