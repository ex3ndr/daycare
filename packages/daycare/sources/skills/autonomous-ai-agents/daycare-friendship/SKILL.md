---
name: daycare-friendship
description: Friendship mechanics for daycare agents. Use when the user wants to add friends, manage friend requests, send messages to friends, share or unshare subusers with friends, or understand what nametags are.
---

# Friendship

Daycare lets users connect as friends and share subusers across boundaries. This skill covers nametags, the friendship lifecycle, messaging, and subuser sharing.

## What is a Nametag

Every user (and subuser) in Daycare has a **nametag** — a unique, human-readable identifier. Nametags are how users refer to each other in all friend operations.

**Format:** A lowercase string generated from dictionary words plus random digits with no separator, e.g. `swiftfox42`, `happypenguin7`, `lazydog55`.

**Key properties:**
- Required for every user — assigned automatically at creation
- Globally unique across the entire Daycare instance
- Case-insensitive when looking up (always normalized to lowercase)
- Immutable once assigned — nametags do not change
- Used instead of raw user IDs in all user-facing interactions

**How to find a nametag:** Run `topology` — your own nametag appears at the top. Friends and their nametags appear in the Friends section.

## Why Friends

Friendship serves two purposes:

1. **Direct messaging** — Friends can send messages to each other across user boundaries. Without friendship, users are completely isolated.
2. **Subuser sharing** — Owners can share their subusers (isolated applications) with friends, enabling collaboration. A friend who accepts a shared subuser can message it directly.

Friendship is mutual — both sides must agree. This prevents spam and unwanted access.

## Friendship Lifecycle

### States

A relationship between two users progresses through these states:

| State | Meaning |
|-------|---------|
| None | No relationship exists |
| PendingOut | You sent a request, waiting for them to accept |
| PendingIn | They sent you a request, waiting for you to accept |
| Friends | Both sides accepted — full access to messaging and sharing |

### Flow

**Adding a friend:**

1. You call `friend_add("their-nametag")` — state moves to **PendingOut**
2. They receive a system message notifying them of your request
3. They call `friend_add("your-nametag")` — state moves to **Friends**
4. You receive a system message confirming the friendship

**Rejecting or canceling:**

- If you have a pending incoming request: `friend_remove("their-nametag")` rejects it (state returns to None)
- If you sent a pending outgoing request: `friend_remove("their-nametag")` cancels it (state returns to None)

**Unfriending:**

- Either side calls `friend_remove("their-nametag")` — the friendship ends
- All subuser shares between the two users are automatically cleaned up
- The other side receives a notification

### Cooldown

After removing a friend or having a request rejected, there is a **7-day cooldown** before you can send a new request to the same user.

## Friend Tools

### `friend_add`

Send or accept a friend request by nametag.

**Parameters:**
- `nametag` (string) — the target user's nametag

**Behavior:**
- If no relationship exists: creates a pending outgoing request
- If they already sent you a request: accepts it and you become friends
- If you are already friends: returns current status (no-op)
- If a pending subuser share offer exists from a friend: accepts the share

**Example:**
```
friend_add({ nametag: "swiftfox42" })
// → { summary: "Friend request sent to swiftfox42", status: "pending_out", nametag: "swiftfox42" }
```

### `friend_remove`

Unfriend, reject a request, or cancel a pending request by nametag.

**Parameters:**
- `nametag` (string) — the target user's nametag

**Behavior:**
- If friends: unfriends and cleans up all subuser shares between you
- If pending incoming: rejects the request
- If pending outgoing: cancels the request
- If a shared subuser: removes the share from your side

**Example:**
```
friend_remove({ nametag: "swiftfox42" })
// → { summary: "Removed swiftfox42 as friend", status: "removed", nametag: "swiftfox42" }
```

### `friend_send`

Send a direct message to a friend by nametag.

**Parameters:**
- `nametag` (string) — the friend's nametag (or a shared subuser's nametag)
- `message` (string) — the message text to send

**Requirements:**
- You must be mutual friends (both sides accepted)
- For shared subusers: the share must be active (both sides accepted)

**Behavior:**
- Delivers the message as a system message to the friend's agents
- When messaging a shared subuser, delivers to that subuser's gateway agent

**Example:**
```
friend_send({ nametag: "swiftfox42", message: "Hey, can you check the latest deploy?" })
// → { summary: "Message sent to swiftfox42", nametag: "swiftfox42" }
```

### `friend_share_subuser`

Share one of your subusers with a friend. Only the owner of the subuser can call this.

**Parameters:**
- `friendNametag` (string) — the friend's nametag
- `subuserId` (string) — the ID of the subuser to share

**Requirements:**
- You must own the subuser
- You must be mutual friends with the target

**Behavior:**
- Creates a pending share offer (subuser side requested, friend side pending)
- The friend receives a notification with the subuser's nametag
- The friend must call `friend_add("<subuser-nametag>")` to accept the share

**Example:**
```
friend_share_subuser({ friendNametag: "swiftfox42", subuserId: "sub_abc123" })
// → { summary: "Shared subuser with swiftfox42 (pending acceptance)", status: "pending", ... }
```

### `friend_unshare_subuser`

Revoke a subuser share from a friend. Only the owner of the subuser can call this.

**Parameters:**
- `friendNametag` (string) — the friend's nametag
- `subuserId` (string) — the ID of the subuser to unshare

**Behavior:**
- Removes the share regardless of whether it was pending or active
- The friend receives a notification that access was revoked
- The friend can no longer message the subuser

**Example:**
```
friend_unshare_subuser({ friendNametag: "swiftfox42", subuserId: "sub_abc123" })
// → { summary: "Revoked subuser share from swiftfox42", status: "removed", ... }
```

## Subuser Sharing

Subuser sharing lets an owner grant a friend access to one of their isolated subusers. This enables cross-user collaboration through the subuser's gateway agent.

### What is a Subuser

A subuser is an isolated application created by the owner. It has its own memory, filesystem, and agent scope. Each subuser has a **gateway agent** — the single entry point for receiving messages.

### Share Lifecycle

1. **Owner initiates:** `friend_share_subuser("swiftfox42", subuserId)` — creates a pending share
2. **Friend sees notification:** a system message with the subuser's nametag and description
3. **Friend accepts:** `friend_add("<subuser-nametag>")` — share becomes active
4. **Friend can now message:** `friend_send("<subuser-nametag>", "hello")` — delivers to gateway agent
5. **Revocation (either side):**
   - Owner: `friend_unshare_subuser("swiftfox42", subuserId)` — revokes access
   - Friend: `friend_remove("<subuser-nametag>")` — removes from their side

### Share States

| State | Meaning |
|-------|---------|
| Pending | Owner shared, friend hasn't accepted yet |
| Active | Both sides confirmed — friend can message the subuser |

### Automatic Cleanup

When two users unfriend each other (via `friend_remove`), **all subuser shares between them are automatically deleted**. No manual cleanup is needed.

## Inspecting Friends

Use `topology` (no parameters) to see your current friend connections and shared subusers.

**Friends section format:**

```
## Friends (2)
swiftfox42
  -> shared out: helper (nametag=coolcat11) gateway=gw-abc status=active
  -> shared out: assistant (nametag=lazydog55) gateway=gw-def status=pending
  <- shared in: bob-helper (nametag=smartowl22) gateway=gw-ghi status=active

happypenguin7
  (no shared subusers)
```

**Reading the topology:**
- `-> shared out` = your subuser shared to that friend
- `<- shared in` = their subuser shared to you
- `status=active` = both sides accepted, messaging works
- `status=pending` = waiting for acceptance
- The gateway ID is useful for `send_agent_message` if needed

**Note:** Subuser agents cannot see the Friends section. Only non-subuser (owner) agents see friend information in topology.

## Common Scenarios

### Adding a Friend

User A wants to connect with User B:

```
// User A:
friend_add({ nametag: "userbtag123" })
// Status: pending_out — User B gets notified

// User B (after receiving notification):
friend_add({ nametag: "useratag456" })
// Status: friends — both sides confirmed
```

### Sharing a Subuser with a Friend

Owner wants to give a friend access to their "research-assistant" subuser:

```
// Step 1: Owner shares
friend_share_subuser({ friendNametag: "swiftfox42", subuserId: "sub_research" })
// Friend gets notified with the subuser's nametag (e.g. "smartowl22")

// Step 2: Friend accepts
friend_add({ nametag: "smartowl22" })
// Share is now active

// Step 3: Friend messages the subuser
friend_send({ nametag: "smartowl22", message: "Summarize recent findings" })
// Message delivered to the research-assistant gateway agent
```

### Checking Who Your Friends Are

```
topology()
// Look at the "## Friends" section for the full list
```

### Cleaning Up a Friendship

```
// Unfriend — also removes all shared subusers between you
friend_remove({ nametag: "swiftfox42" })
```

### Revoking a Single Subuser Share

```
// Owner revokes without unfriending
friend_unshare_subuser({ friendNametag: "swiftfox42", subuserId: "sub_helper" })
```

## Important Rules

1. **Friendship is mutual.** Both sides must call `friend_add` before messaging or sharing works.
2. **Messaging requires friendship.** `friend_send` fails if you are not mutual friends (or if a subuser share is not active).
3. **Only owners can share subusers.** You cannot share a subuser you do not own.
4. **Only owners can revoke shares.** Use `friend_unshare_subuser`. Friends can remove from their side with `friend_remove`.
5. **Unfriending cleans up everything.** All subuser shares between the two users are deleted automatically.
6. **Cooldown after removal.** You must wait 7 days before re-requesting someone you removed or who rejected you.
7. **Nametags are case-insensitive.** `SwiftFox42` and `swiftfox42` resolve to the same user.
8. **Subuser agents cannot manage friends.** Only owner (non-subuser) agents have access to friend tools and see the Friends section in topology.
9. **Use topology to discover nametags.** Do not guess nametags — always check topology or ask the user.
