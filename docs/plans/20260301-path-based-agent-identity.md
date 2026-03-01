# Path-Based Agent Identity

## Overview

Replace the `AgentDescriptor` discriminated union (10 variants with embedded metadata) with a **path-based actor address** system. Each agent is identified by a globally-routable path string (e.g., `/<userId>/telegram`, `/<userId>/agent/claude`, `<parent>/sub/0`) that resolves to a CUID2 agent ID. Metadata (name, systemPrompt, description, etc.) moves out of the identity type into a separate `config` JSON column. The path becomes the sole identity for routing, lookup, and hierarchy — actor model style.

All paths are rooted under `/<userId>/...` (except `/system/<tag>`). Connector agents sit directly under the user: `/<userId>/telegram`, `/<userId>/whatsapp`. Since groups get their own userId at the system level, there's no user/group distinction in paths — the userId already handles that.

**What changes:**
- `AgentDescriptor` union → `AgentPath` branded string
- `agentDescriptorCacheKey()` → the path itself (path IS the cache key)
- `AgentPostTarget` uses `{ path }` instead of `{ descriptor }`
- DB schema: `type` + `descriptor` columns → `path` + `config` columns
- Connectors emit paths instead of descriptor objects
- All descriptor-based switch/if chains → path pattern matching

**What stays the same:**
- CUID2 agent IDs (path resolves to them)
- Context class (userId + agentId)
- Agent lifecycle (active/sleeping/dead)
- Inbox, sessions, history — untouched
- App descriptors — deferred to later refactor

## Context (from discovery)

### Files directly affected (core descriptor system):
- `engine/agents/ops/agentDescriptorTypes.ts` — type definition (replaced)
- `engine/agents/ops/agentDescriptorCacheKey.ts` — cache key (replaced by path)
- `engine/agents/ops/agentDescriptorRead.ts` — load from DB (rewritten)
- `engine/agents/ops/agentDescriptorWrite.ts` — persist to DB (rewritten)
- `engine/agents/ops/agentDescriptorLabel.ts` — display name (rewritten)
- `engine/agents/ops/agentDescriptorRoleResolve.ts` — model role (rewritten)
- `engine/agents/ops/agentDescriptorTargetResolve.ts` — connector target (rewritten)
- `engine/agents/ops/agentDescriptorMatchesStrategy.ts` — strategy filter (rewritten)
- `engine/agents/ops/agentAppFolderPathResolve.ts` — app folder (updated)
- `engine/agents/ops/agentTypes.ts` — `AgentPostTarget` (updated)

### Files affected (agent system):
- `engine/agents/agentSystem.ts` — routing, resolution, keyMap
- `engine/agents/agent.ts` — stores descriptor, uses for role/target
- `engine/agents/ops/agentList.ts` — returns descriptors
- `engine/engine.ts` — descriptor context resolution
- `engine/messages/incomingMessages.ts` — message batching by descriptor

### Files affected (consumers):
- `engine/modules/tools/permanentAgentToolBuild.ts` — creates permanent descriptors
- `engine/subusers/subusers.ts` — creates subuser descriptors
- `engine/memory/memoryWorker.ts` — creates memory-agent descriptors
- `engine/cron/crons.ts` — creates task descriptors
- `engine/tasks/taskExecutions.ts` — dispatches with descriptor targets
- `plugins/telegram/connector.ts` — emits user descriptors
- `plugins/telegram/plugin.ts` — checks descriptor type
- `plugins/whatsapp/connector.ts` — emits user descriptors
- `engine/modules/connectorRegistry.ts` — passes descriptors
- `storage/databaseTypes.ts` — DB types with descriptor
- `storage/agentsRepository.ts` — persists descriptors
- `storage/migrations/` — schema
- `types.ts` — re-exports
- `packages/daycare-dashboard/lib/agent-types.ts` — UI mapping
- 20+ test files

## Path Scheme

### Design Principles
- All agent paths are `/<userId>/<type>/...` (except `/system/<tag>`)
- Path alone is globally unique — no secondary key needed
- Path encodes hierarchy — parent/child relationships visible in path structure
- Path is the cache key — no separate `agentDescriptorCacheKey()` function
- Metadata lives separately — path is identity only, config holds the rest
- Connectors are just another agent type under the user — `/<userId>/telegram`

### Path Patterns

```
# Connector agents (userId is the user or group — groups get own userId)
/<userId>/telegram                   → Telegram agent for this user/group
/<userId>/whatsapp                   → WhatsApp agent for this user
/<userId>/direct                     → Direct protocol agent

# Named/configured agents
/<userId>/agent/<name>               → permanent named agent
/<userId>/cron/<id>                  → cron job agent
/<userId>/task/<id>                  → one-off task agent
/<userId>/subuser/<id>              → subuser gateway agent

# System agents (globally unique by tag)
/system/<tag>                        → system agent

# Relative suffixes (appended to any parent agent path)
<parent>/sub/<index>                 → subagent (auto-incrementing integer)
<parent>/memory                      → memory extraction agent
<parent>/search/<index>              → memory search agent

# Apps — deferred (keep existing descriptor for now)
```

### Examples

```
/u_abc123/telegram                              → Telegram agent for user u_abc123
/u_abc123/telegram/sub/0                        → first subagent of that telegram agent
/u_abc123/telegram/sub/0/memory                 → memory agent for the subagent
/u_abc123/telegram/sub/0/search/0               → first memory search of the subagent

/u_grp456/telegram                              → Telegram agent for group u_grp456 (group has own userId)

/u_abc123/agent/claude                          → permanent agent "claude" for user
/u_abc123/agent/claude/sub/0                    → first subagent of claude
/u_abc123/agent/claude/sub/1                    → second subagent of claude
/u_abc123/agent/claude/sub/1/sub/0              → nested subagent

/u_abc123/cron/daily-sync                       → cron agent
/u_abc123/task/xyz789                           → one-off task agent
/u_abc123/subuser/sub456                        → subuser gateway

/system/gc                                      → system agent
```

### Path Type Detection

The second segment after `/<userId>/` determines the agent type. Reserved keywords:
- `agent`, `cron`, `task`, `subuser` — known agent types
- Everything else (e.g., `telegram`, `whatsapp`, `direct`) — connector type

Suffix patterns override root type:
- `*/sub/<N>` → subagent
- `*/memory` → memory agent
- `*/search/<N>` → memory search agent

### Path → Role Mapping

| Path pattern | Model role |
|---|---|
| `/<userId>/<connector>` (telegram, whatsapp, etc.) | `"user"` |
| `/<userId>/agent/*` | `"user"` |
| `/<userId>/subuser/*` | `"user"` |
| `*/sub/*` (any subagent) | `"subagent"` |
| `*/memory` | `"memory"` |
| `*/search/*` | `"memorySearch"` |
| `/<userId>/task/*` | `"task"` |
| `/<userId>/cron/*` | `null` |
| `/system/*` | `null` |

### Path → Connector Target Resolution

Connector target (for sending messages back) is resolved via the user's connector keys in the DB, not from the path itself:
1. Parse `/<userId>/telegram` → connector name = `"telegram"`, userId = `<userId>`
2. Look up `user_connector_keys` for that userId → `"telegram:123456"` → targetId = `"123456"`
3. Return `{ connector: "telegram", targetId: "123456" }`

This keeps paths clean and avoids encoding external IDs in the path.

### Subagent Index Counter

Each agent record gets a `nextSubIndex` integer (default 0). When spawning a subagent:
1. Read parent's `nextSubIndex`
2. New subagent path = `<parentPath>/sub/<nextSubIndex>`
3. Increment parent's `nextSubIndex`

### Agent Config (Metadata)

Path is identity. Everything else goes into a `config` JSON column:

```typescript
type AgentConfig = {
    name?: string;
    username?: string;
    description?: string;
    systemPrompt?: string;
    workspaceDir?: string;
    connectorUserId?: string;   // external connector user ID (for user agents)
};
```

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility during migration (dual-write path + descriptor until cutover)

## Testing Strategy
- **Unit tests**: required for every task
- Path building/parsing functions: exhaustive tests for all patterns
- Role resolution: test all path patterns
- Integration: agent creation, routing, subagent spawning via paths

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Define AgentPath type and path building functions
- [ ] Create `engine/agents/ops/agentPathTypes.ts` with `AgentPath` branded string type and `AgentPathKind` union
- [ ] Create `engine/agents/ops/agentPathBuild.ts` with builder functions for each path pattern:
  - `agentPathConnector(userId, connector)` → `/<userId>/telegram`
  - `agentPathAgent(userId, name)` → `/<userId>/agent/<name>`
  - `agentPathCron(userId, id)` → `/<userId>/cron/<id>`
  - `agentPathTask(userId, id)` → `/<userId>/task/<id>`
  - `agentPathSubuser(userId, id)` → `/<userId>/subuser/<id>`
  - `agentPathSystem(tag)` → `/system/<tag>`
  - `agentPathSub(parentPath, index)` → `<parent>/sub/<index>`
  - `agentPathMemory(agentPath)` → `<agent>/memory`
  - `agentPathSearch(agentPath, index)` → `<agent>/search/<index>`
- [ ] Create `engine/agents/ops/agentPathParse.ts` to extract components from paths:
  - `agentPathKind(path)` → segment-based type detection (connector, agent, cron, task, sub, memory, search, system, subuser)
  - `agentPathParent(path)` → parent path or null
  - `agentPathUserId(path)` → extract userId (first segment, except for `/system/*`)
  - `agentPathConnectorName(path)` → connector name or null (for connector-type paths)
- [ ] Write tests for `agentPathBuild` — all path patterns, edge cases
- [ ] Write tests for `agentPathParse` — type detection, parent extraction, userId extraction
- [ ] Run tests — must pass before next task

### Task 2: Define AgentConfig type and path-based role/label resolution
- [ ] Create `engine/agents/ops/agentConfigTypes.ts` with `AgentConfig` type (name, systemPrompt, description, etc.)
- [ ] Create `engine/agents/ops/agentPathRoleResolve.ts` — map path patterns to model roles using `agentPathType()`
- [ ] Create `engine/agents/ops/agentPathLabel.ts` — derive display label from path + optional config name
- [ ] Create `engine/agents/ops/agentPathMatchesStrategy.ts` — check if path matches fetch strategy
- [ ] Write tests for role resolution — all path patterns to correct roles
- [ ] Write tests for label generation — paths with/without config names
- [ ] Write tests for strategy matching
- [ ] Run tests — must pass before next task

### Task 3: Add path + config columns to DB schema
- [ ] Add migration: `path` (text, nullable initially) and `config` (text/JSON, nullable) columns to `agents` table
- [ ] Add `next_sub_index` (integer, default 0) column to `agents` table
- [ ] Update `DatabaseAgentRow` and `AgentDbRecord` in `databaseTypes.ts` to include `path`, `config`, `nextSubIndex`
- [ ] Update `agentsRepository.ts` to read/write path, config, nextSubIndex fields
- [ ] Add unique index on `path` column (once populated)
- [ ] Write tests for repository CRUD with new fields
- [ ] Run tests — must pass before next task

### Task 4: Dual-write paths alongside descriptors
- [ ] Update `agentDescriptorWrite()` to also compute and write `path` from descriptor
- [ ] Create `agentPathFromDescriptor()` bridge function that converts existing descriptors to paths
- [ ] Update `Agent.create()` to store path alongside descriptor
- [ ] Update `agentSystem.resolveEntry()` to populate path when creating agents
- [ ] Ensure all existing agent creation flows write path
- [ ] Write tests for descriptor-to-path conversion — all 10 descriptor types
- [ ] Run tests — must pass before next task

### Task 5: Switch AgentPostTarget and routing to paths
- [ ] Update `AgentPostTarget` type: `{ agentId: string } | { path: AgentPath }`
- [ ] Update `agentSystem.resolveEntry()` to resolve by path instead of descriptor cache key
- [ ] Update `agentSystem.post()` and `postAndAwait()` for new target type
- [ ] Update `agentSystem.abortInferenceForTarget()` for path-based targets
- [ ] Replace `keyMap: Map<cacheKey, agentId>` with `pathMap: Map<path, agentId>`
- [ ] Update `findLoadedEntry()` to match by path
- [ ] Update all call sites that create `AgentPostTarget` with descriptors → use paths
- [ ] Write tests for path-based routing — create, resolve, post
- [ ] Run tests — must pass before next task

### Task 6: Update connector interface to emit paths
- [ ] Update `ConnectorRegistryOptions.onMessage` signature: descriptor → path
- [ ] Update `ConnectorRegistry.attach()` to pass paths
- [ ] Update `Connector` type's `MessageHandler` and `CommandHandler` to use path
- [ ] Update Telegram connector to resolve userId via connector key, then emit `/<userId>/telegram` path
- [ ] Update WhatsApp connector similarly
- [ ] Update `engine.ts` descriptor context resolution to work with paths
- [ ] Connector target resolution: look up `user_connector_keys` by userId to get external target ID
- [ ] Write tests for connector path emission
- [ ] Run tests — must pass before next task

### Task 7: Update agent creation sites to use paths + config
- [ ] Update `permanentAgentToolBuild.ts` — build path + config instead of descriptor
- [ ] Update `subusers.ts` — build subuser path + config
- [ ] Update `memoryWorker.ts` — build memory-agent/memory-search paths
- [ ] Update `crons.ts` — build cron/task paths
- [ ] Update `taskExecutions.ts` — use path-based targets
- [ ] Update subagent spawning (e.g., `buildStartBackgroundAgentTool`) — use `<parent>/sub/<index>` paths with nextSubIndex
- [ ] Write tests for each creation site
- [ ] Run tests — must pass before next task

### Task 8: Update agent reads and queries to use paths
- [ ] Replace `agentDescriptorRead()` with `agentPathRead()` and `agentConfigRead()`
- [ ] Update `agentList()` to return path instead of descriptor
- [ ] Update `Agent` class: replace `descriptor: AgentDescriptor` field with `path: AgentPath` and `config: AgentConfig`
- [ ] Update `agentSystem.getAgentDescriptor()` → `getAgentPath()` / `getAgentConfig()`
- [ ] Update `agentSystem.updateAgentDescriptor()` → `updateAgentConfig()`
- [ ] Update `agentSystem.sleepIfIdle()` — use path type detection instead of descriptor.type
- [ ] Update `agentSystem.postToUserAgents()` — filter by path pattern instead of descriptor.type
- [ ] Update `agentAppFolderPathResolve()` — use path + config
- [ ] Write tests for path-based reads and queries
- [ ] Run tests — must pass before next task

### Task 9: Update downstream consumers
- [ ] Update `incomingMessages.ts` — batch by path instead of descriptor cache key
- [ ] Update Telegram plugin `systemPrompt()` — check path pattern instead of descriptor.type
- [ ] Update dashboard `agent-types.ts` — derive `AgentType` from path instead of descriptor
- [ ] Update topography observation events — use path instead of descriptor type/label
- [ ] Update any remaining tools that inspect descriptors
- [ ] Write tests for each updated consumer
- [ ] Run tests — must pass before next task

### Task 10: Remove old descriptor code
- [ ] Remove `agentDescriptorTypes.ts` (the union type)
- [ ] Remove `agentDescriptorCacheKey.ts` (replaced by path itself)
- [ ] Remove `agentDescriptorRead.ts` (replaced by path/config reads)
- [ ] Remove `agentDescriptorWrite.ts` (replaced by path/config writes)
- [ ] Remove `agentDescriptorLabel.ts` (replaced by `agentPathLabel`)
- [ ] Remove `agentDescriptorRoleResolve.ts` (replaced by `agentPathRoleResolve`)
- [ ] Remove `agentDescriptorTargetResolve.ts` (replaced by `agentPathConnectorTarget`)
- [ ] Remove `agentDescriptorMatchesStrategy.ts` (replaced by `agentPathMatchesStrategy`)
- [ ] Remove `descriptor` and `type` columns from DB schema (migration)
- [ ] Remove `AgentDescriptor` from `types.ts` re-exports, add `AgentPath` and `AgentConfig`
- [ ] Clean up all remaining imports of removed files
- [ ] Run tests — must pass before next task

### Task 11: Update all test files
- [ ] Rewrite `agentDescriptorCacheKey.spec.ts` → `agentPathBuild.spec.ts` (done in task 1)
- [ ] Rewrite `agentDescriptorLabel.spec.ts` → `agentPathLabel.spec.ts` (done in task 2)
- [ ] Rewrite `agentDescriptorRoleResolve.spec.ts` → `agentPathRoleResolve.spec.ts` (done in task 2)
- [ ] Rewrite `agentDescriptorTargetResolve.spec.ts` → path connector target tests (done in task 1)
- [ ] Rewrite `agentDescriptorWrite.spec.ts` → path/config write tests
- [ ] Update `agentSystem.spec.ts` — use paths in all test setups
- [ ] Update `agent.spec.ts` — use paths instead of descriptors
- [ ] Update `memoryWorker.spec.ts` — use memory paths
- [ ] Update `crons.spec.ts` — use cron/task paths
- [ ] Update `taskExecutions.spec.ts` — use path-based targets
- [ ] Update `connector.spec.ts` files (telegram, whatsapp) — expect paths
- [ ] Update all other spec files creating descriptor literals
- [ ] Run full test suite
- [ ] Run linter — all issues must be fixed

### Task 12: Verify acceptance criteria
- [ ] Verify all agent types addressable by path
- [ ] Verify path globally routes without ambiguity
- [ ] Verify subagent indices auto-increment correctly
- [ ] Verify memory/search paths derive from parent
- [ ] Verify connector target extraction works from paths
- [ ] Verify role resolution correct for all path patterns
- [ ] Verify no remaining references to `AgentDescriptor` (except app — deferred)
- [ ] Run full test suite (unit tests)
- [ ] Run linter — all issues must be fixed

### Task 13: [Final] Update documentation
- [ ] Update `doc/internals/agent-types.md` with new path scheme
- [ ] Update plugin README files that reference descriptors
- [ ] Add `doc/internals/agent-paths.md` documenting the path scheme with examples

## Technical Details

### AgentPath Type
```typescript
// Branded string for type safety
type AgentPath = string & { readonly __brand: unique symbol };

function agentPath(raw: string): AgentPath {
    return raw as AgentPath;
}
```

### Path Type Detection
```typescript
type AgentPathKind =
    | "connector"    // /<userId>/telegram, /<userId>/whatsapp
    | "agent"        // /<userId>/agent/*
    | "cron"         // /<userId>/cron/*
    | "task"         // /<userId>/task/*
    | "subuser"      // /<userId>/subuser/*
    | "system"       // /system/*
    | "sub"          // */sub/*
    | "memory"       // */memory
    | "search";      // */search/*

// Reserved second-segment keywords — anything else is a connector name
const KNOWN_SEGMENTS = new Set(["agent", "cron", "task", "subuser"]);

function agentPathKind(path: AgentPath): AgentPathKind {
    // Check suffix patterns first (sub, memory, search)
    if (path.endsWith("/memory")) return "memory";
    if (/\/search\/\d+$/.test(path)) return "search";
    if (/\/sub\/\d+/.test(path)) return "sub";
    // System agents
    if (path.startsWith("/system/")) return "system";
    // User-scoped: /<userId>/<segment>/...
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2) {
        const segment = segments[1];
        if (segment === "agent") return "agent";
        if (segment === "cron") return "cron";
        if (segment === "task") return "task";
        if (segment === "subuser") return "subuser";
        // Not a reserved keyword → connector
        return "connector";
    }
    throw new Error(`Unknown path pattern: ${path}`);
}
```

### DB Migration
```sql
ALTER TABLE agents ADD COLUMN path TEXT;
ALTER TABLE agents ADD COLUMN config TEXT;
ALTER TABLE agents ADD COLUMN next_sub_index INTEGER NOT NULL DEFAULT 0;

-- After backfill:
-- CREATE UNIQUE INDEX idx_agents_path ON agents (path) WHERE valid_to IS NULL;
-- ALTER TABLE agents DROP COLUMN type;
-- ALTER TABLE agents DROP COLUMN descriptor;
```

### Connector Path Emission (Telegram Example)
```typescript
// Before:
const descriptor: AgentDescriptor = {
    type: "user",
    connector: "telegram",
    userId: String(message.from?.id),
    channelId: String(message.chat.id)
};

// After — connector resolves userId first, then builds path:
// Groups and users both map to a userId via connector key resolution.
// The connector key ("telegram:123456") resolves to an internal userId.
const connectorKey = userConnectorKeyCreate("telegram", String(externalId));
const userId = await resolveUserByConnectorKey(connectorKey);
const path = agentPathConnector(userId, "telegram");
// Result: /<userId>/telegram
```

### AgentConfig Type
```typescript
type AgentConfig = {
    name?: string;
    username?: string;
    description?: string;
    systemPrompt?: string;
    workspaceDir?: string;
    /** App ID for app-type agents (deferred, keep for forward compat) */
    appId?: string;
};
```

External connector IDs (e.g., Telegram user ID) are resolved through `user_connector_keys` table, not stored in config.

## Post-Completion

**Manual verification:**
- Test with running Telegram bot — messages route correctly via paths
- Test subagent spawning — indices increment, paths nest correctly
- Test memory worker — memory/search paths created from parent
- Test cron/task execution — paths resolve correctly

**Deferred work (future PRs):**
- App descriptor migration to paths (`/<userId>/app/<appId>` or `<parent>/app/<appId>`)
- Path-based permissions (read/write scoped to path subtrees)
