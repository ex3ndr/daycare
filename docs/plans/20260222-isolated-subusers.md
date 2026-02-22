# Isolated Subusers

## Overview
Add a subuser isolation primitive: the owner can create child users that get their own memory, filesystem sandbox, agents, cron, signals, etc. Each subuser has one auto-created **gateway agent** that receives all messages forwarded by the owner's agents. The gateway agent has a configurable system prompt (set via tool). Owner agents communicate with subuser gateway agents through the existing `send_agent_message` tool, extended to allow cross-user messaging within the parent-child boundary. Gateway agents can reply back to whoever messaged them.

**Key properties:**
- Complete isolation: memory, filesystem, sandbox, signals, channels all scoped to the subuser's `userId`
- Gateway agent: auto-created with the subuser, receives messages from owner agents
- Configurable behavior: owner can update gateway agent's system prompt anytime
- One-way initiation: only owner agents can initiate; gateway agents can reply back
- Topology: owner sees subusers section; subuser agents see only their own scope

## Context (from discovery)

### Existing infrastructure that provides isolation for free
- **Memory**: already user-scoped at `<usersDir>/<userId>/memory/graph/`
- **Filesystem**: `UserHome` provides per-user directories (`home/`, `skills/`, `apps/`)
- **Sandbox**: permissions derived from `UserHome`, scoped to user's directories
- **DB entities**: agents, cron, heartbeats, signals, channels, exposes, processes all have `user_id` column

### Files that handle `AgentDescriptor` type (all need new `subuser` case)
- `agentDescriptorTypes.ts` — union definition
- `agentDescriptorCacheKey.ts` — cache key builder (exhaustive switch)
- `agentDescriptorLabel.ts` — human-friendly label
- `agentDescriptorMatchesStrategy.ts` — fetch strategy matching
- `agentDescriptorTargetResolve.ts` — connector target resolution
- `agentDescriptorRoleResolve.ts` — model role mapping
- `agentPromptResolve.ts` — system prompt resolution
- `agentSystem.ts` → `resolveUserIdForDescriptor` — user ID resolution

### Key patterns
- Migrations in `sources/storage/migrations/`, registered in `_migrations.ts`
- Tools built as `*ToolBuild.ts` functions, registered in `engine.ts`
- `send_agent_message` in `background.ts` posts to `agentSystem.post()` with origin

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Implementation Steps

### Task 1: Add `parent_user_id` and `name` columns to users table
- [x] Create migration `20260222_add_user_parent.ts`: `ALTER TABLE users ADD COLUMN parent_user_id TEXT REFERENCES users(id)` and `ALTER TABLE users ADD COLUMN name TEXT`
- [x] Add index: `CREATE INDEX idx_users_parent ON users(parent_user_id) WHERE parent_user_id IS NOT NULL`
- [x] Register migration in `_migrations.ts`
- [x] Update `DatabaseUserRow` in `databaseTypes.ts`: add `parent_user_id TEXT | null` and `name TEXT | null`
- [x] Update `UserDbRecord` in `databaseTypes.ts`: add `parentUserId: string | null` and `name: string | null`
- [x] Update `CreateUserInput`: add optional `parentUserId?: string` and `name?: string`
- [x] Update `UsersRepository`: map new columns in `create()`, `userLoadById()`, `findMany()`, `userClone()`
- [x] Add `findByParentUserId(parentUserId: string)` method to `UsersRepository`
- [x] Write migration test in `20260222_add_user_parent.spec.ts`
- [x] Write test for `findByParentUserId` in existing or new spec
- [x] Run tests — must pass before task 2

### Task 2: Add `subuser` agent descriptor type
- [x] Add `{ type: "subuser"; id: string; name: string; systemPrompt: string }` variant to `AgentDescriptor` union in `agentDescriptorTypes.ts`
- [x] Add cache key case `case "subuser": return \`/subuser/${descriptor.id}\`` in `agentDescriptorCacheKey.ts`
- [x] Add label case in `agentDescriptorLabel.ts`: return `descriptor.name`
- [x] Add strategy case in `agentDescriptorMatchesStrategy.ts`: return `false` for all strategies
- [x] Add target case in `agentDescriptorTargetResolve.ts`: return `null` (no connector target)
- [x] Add role case in `agentDescriptorRoleResolve.ts`: return `"user"` (uses the user model role)
- [x] Add prompt case in `agentPromptResolve.ts`: return `{ agentPrompt: descriptor.systemPrompt, replaceSystemPrompt: false }` (same pattern as `permanent`/`app`)
- [x] Add user resolution in `agentSystem.ts` → `resolveUserIdForDescriptor`: for `subuser`, look up the agent's target userId from the subuser record. The subuser's gateway agent descriptor carries an `id` that matches the subuser's `userId`. Resolution: find user by id, return that userId
- [x] Update tests: `agentDescriptorCacheKey.spec.ts`, `agentDescriptorLabel.spec.ts`, `agentDescriptorRoleResolve.spec.ts`, `agentPromptResolve.spec.ts`
- [x] Run tests — must pass before task 3

### Task 3: Create `subuser_create` tool
- [x] Create `subuserCreateToolBuild.ts` in `sources/engine/modules/tools/`
- [x] Schema: `{ name: string, systemPrompt: string }`
- [x] Implementation:
  - Validate caller is owner user (`ctx.userId` matches owner)
  - Create child user via `storage.users.create({ parentUserId: ctx.userId, name })`
  - Ensure subuser's `UserHome` directories via `userHomeEnsure`
  - Create gateway agent with descriptor `{ type: "subuser", id: subuserUserId, name, systemPrompt }`
  - Post to agent system to register the agent
  - Return `{ subuserId, gatewayAgentId, name }`
- [x] Add `visibleByDefault`: only visible when `ctx.userId` belongs to the owner user
- [x] Register tool in `engine.ts`
- [x] Write tests for `subuserCreateToolBuild.spec.ts`
- [x] Run tests — must pass before task 4

### Task 4: Create `subuser_configure` tool
- [x] Create `subuserConfigureToolBuild.ts` in `sources/engine/modules/tools/`
- [x] Schema: `{ subuserId: string, systemPrompt: string }`
- [x] Implementation:
  - Validate caller is owner user
  - Validate subuser exists and has `parentUserId` matching caller's userId
  - Find the gateway agent (type `subuser` with id matching subuserId)
  - Update the agent's descriptor with new `systemPrompt`
  - Persist the updated descriptor
  - Return confirmation
- [x] Add `visibleByDefault`: only visible to owner user's agents
- [x] Register tool in `engine.ts`
- [x] Write tests for `subuserConfigureToolBuild.spec.ts`
- [x] Run tests — must pass before task 5

### Task 5: Create `subuser_list` tool
- [x] Create `subuserListToolBuild.ts` in `sources/engine/modules/tools/`
- [x] Schema: `{}` (no params)
- [x] Implementation:
  - Validate caller is owner user
  - Query `storage.users.findByParentUserId(ctx.userId)`
  - For each subuser, find their gateway agent from agent storage
  - Return list of `{ subuserId, name, gatewayAgentId, gatewayLifecycle }`
- [x] Add `visibleByDefault`: only visible to owner user's agents
- [x] Register tool in `engine.ts`
- [x] Write tests for `subuserListToolBuild.spec.ts`
- [x] Run tests — must pass before task 6

### Task 6: Extend `send_agent_message` for cross-user communication
- [x] In `background.ts` `buildSendAgentMessageTool()`, add validation:
  - When target agent belongs to a different userId than caller, check parent-child relationship
  - Allow if: caller's user is parent of target's user, OR target's user is parent of caller's user
  - Reject cross-user messaging outside the parent-child boundary
- [x] To check: load target agent's userId from storage, load both users, verify `parentUserId` relationship
- [x] Ensure origin is set so gateway agent can reply back
- [x] Write tests for cross-user messaging validation
- [x] Run tests — must pass before task 7

### Task 7: Filter topology for subuser isolation
- [x] In `topologyToolBuild.ts`, filter agent list by `callerUserId` — subuser agents only see agents belonging to their own userId
- [x] For owner users: add a `## Subusers` section listing each subuser with their gateway agent info
- [x] Filter cron tasks, heartbeat tasks, signal subscriptions, channels by userId for subuser agents
- [x] Write tests for topology filtering
- [x] Run tests — must pass before task 8

### Task 8: Verify acceptance criteria
- [x] Verify: subuser creation creates isolated user with own memory/filesystem
- [x] Verify: gateway agent uses configurable system prompt
- [x] Verify: owner agents can send messages to gateway agent
- [x] Verify: gateway agent can reply back to origin agent
- [x] Verify: topology shows subusers for owner, isolated view for subusers
- [x] Verify: subuser agents cannot see owner's agents or other subusers
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed

### Task 9: [Final] Update documentation
- [x] Add `doc/subusers.md` documenting the subuser concept, tools, and communication flow
- [x] Update `doc/PLUGINS.md` if relevant
- [x] Add mermaid diagram showing subuser isolation boundaries and message flow

## Technical Details

### New descriptor type
```typescript
| {
    type: "subuser";
    id: string;       // matches the subuser's userId
    name: string;
    systemPrompt: string;
}
```

### User table changes
```sql
ALTER TABLE users ADD COLUMN parent_user_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN name TEXT;
CREATE INDEX idx_users_parent ON users(parent_user_id) WHERE parent_user_id IS NOT NULL;
```

### Message flow
```mermaid
sequenceDiagram
    participant Owner as Owner Agent
    participant AS as AgentSystem
    participant GW as Gateway Agent (subuser)

    Owner->>AS: send_agent_message(agentId=gateway, text="...")
    AS->>AS: validate parent-child relationship
    AS->>GW: post system_message(text, origin=ownerAgentId)
    GW->>GW: process message with custom systemPrompt
    GW->>AS: send_agent_message(agentId=ownerAgentId, text="reply")
    AS->>AS: validate parent-child relationship (reverse)
    AS->>Owner: post system_message(text, origin=gatewayAgentId)
```

### Isolation boundary
```mermaid
graph TB
    subgraph Owner User
        OA[Owner Agent]
        OM[Owner Memory]
        OF[Owner Filesystem]
    end

    subgraph Subuser A
        GA[Gateway Agent A]
        MA[Memory A]
        FA[Filesystem A]
    end

    subgraph Subuser B
        GB[Gateway Agent B]
        MB[Memory B]
        FB[Filesystem B]
    end

    OA -->|send_agent_message| GA
    OA -->|send_agent_message| GB
    GA -->|reply| OA
    GB -->|reply| OA
    GA -.->|isolated| MA
    GA -.->|isolated| FA
    GB -.->|isolated| MB
    GB -.->|isolated| FB
```

## Post-Completion

**Manual verification:**
- Create a subuser via tool call, verify isolated filesystem is created
- Send messages from owner agent to gateway, verify gateway processes with custom prompt
- Verify gateway can reply back
- Verify topology shows correct isolation
- Verify memory observations are stored in subuser's memory directory, not owner's
