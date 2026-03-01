# Remove AgentDescriptor — Path-First Actor Creation

## Overview

Remove `AgentDescriptor` entirely. Agents are created by sending a message to a path. The first message carries creation metadata (config) from the caller. One path = one agent. Config is set once at creation, not updated through descriptors.

**End result:**
- `AgentDescriptor` type deleted — no discriminated union anywhere
- `AgentConfig` type updated — `{ foreground, name, description, systemPrompt, workspaceDir }` (removed `appId`, `connectorUserId`, `username`)
- `AgentConfig` fields are stored as flat DB columns (no JSON blob), repository maps between type and columns
- `Agent.create()` takes `(ctx, path, config, inbox, agentSystem, userHome)` — no descriptor
- `Agent.restore()` takes `(ctx, path, config, state, inbox, agentSystem, userHome)` — no descriptor
- `resolveEntry()` gets creation config from the caller, not from `descriptorForPath()`
- DB `agents` table: `path` (required), `foreground` (boolean), `name`, `description`, `system_prompt`, `workspace_dir` as direct columns — no `type`, `descriptor`, or `config` JSON columns
- Bridge functions (`agentPathFromDescriptor`, `agentConfigFromDescriptor`, `descriptorForPath`) deleted
- All descriptor ops files deleted, `agentConfigFromDescriptor.ts` deleted
- Every site that reads `descriptor.type` or `descriptor.name` uses `agentPathKind(path)` + `config.*` instead

**Why descriptors were wrong:**
Descriptors mixed identity (path/routing) with configuration (systemPrompt, name, workspaceDir). They were meant to be an identity but became a config bag. The fix: path IS the identity, config is set once by the caller at creation time.

**Creation model:**
Each caller knows what fields it needs to provide:
- Connector message → `{ foreground: true }` (connector declares it's user-facing)
- `start_background_agent(prompt, name)` → `{ name }`
- `create_permanent_agent(name, desc, prompt)` → `{ name, description, systemPrompt }`
- Memory worker → `{}` (memory agent needs no fields)
- Cron scheduler → `{ name: cronTask.name }`

The system doesn't need to reverse-engineer fields from path patterns. The caller provides them.

**Foreground detection:**
Connectors set `foreground: true` as a separate field at creation time. This is a dedicated boolean column on the `agents` table (not part of `AgentConfig`). It replaces the old `descriptor.type === "user"` check. The agent explicitly knows whether it faces a human user — stored as a first-class DB field for efficient querying.

## Context (from discovery)

### Current state (partially migrated):
- `AgentPath`, `agentPathBuild`, `agentPathTypes` — already done
- `AgentConfig`, `agentConfigTypes` — exists, will be updated (remove `appId`, `connectorUserId`, `username`; add `foreground`)
- `AgentPostTarget` uses `{ path }` — already done
- `ConnectorTarget` = `AgentPath` — already done
- DB has `path`, `config`, `next_sub_index` columns — already done (nullable); `config` column will be dropped and replaced with individual columns
- `agentDescriptorWrite` dual-writes path + config + descriptor — bridge code
- `descriptorForPath()` in agentSystem — reverse-constructs descriptors from paths (delete)
- `agentPathFromDescriptor()` — converts descriptors to paths (delete)
- `agentConfigFromDescriptor()` — extracts config from descriptors (delete)

### Files to delete:
- `engine/agents/ops/agentDescriptorTypes.ts`
- `engine/agents/ops/agentDescriptorCacheKey.ts`
- `engine/agents/ops/agentDescriptorRead.ts`
- `engine/agents/ops/agentDescriptorWrite.ts`
- `engine/agents/ops/agentDescriptorLabel.ts`
- `engine/agents/ops/agentDescriptorRoleResolve.ts`
- `engine/agents/ops/agentDescriptorTargetResolve.ts`
- `engine/agents/ops/agentDescriptorMatchesStrategy.ts`
- `engine/agents/ops/agentPathFromDescriptor.ts` (bridge)
- `engine/agents/ops/agentConfigFromDescriptor.ts` (bridge)
- All corresponding `.spec.ts` files for the above

### Files to modify:
- `engine/agents/agent.ts` — `create()` and `restore()` signatures
- `engine/agents/agentSystem.ts` — `resolveEntry()`, remove `descriptorForPath()`, entry type
- `engine/agents/ops/agentTypes.ts` — remove `AgentDescriptor` import from BackgroundAgentState
- `storage/databaseTypes.ts` — remove `type`, `descriptor`, `config`; add `foreground`, `name`, `description`, `system_prompt`, `workspace_dir`
- `storage/agentsRepository.ts` — remove descriptor read/write
- `storage/migrations/` — drop `type` + `descriptor` columns
- `types.ts` — remove AgentDescriptor re-export
- `engine/modules/tools/permanentAgentToolBuild.ts` — pass config directly
- `engine/modules/tools/background.ts` — pass config with subagent spawn
- `engine/memory/memoryWorker.ts` — pass config with memory agent creation
- `engine/cron/crons.ts` — pass config with cron agent creation
- `engine/tasks/taskExecutions.ts` — pass config with task execution
- `plugins/telegram/connector.ts` — already emits path, verify no descriptor refs
- `plugins/telegram/plugin.ts` — use path kind instead of descriptor.type
- `engine/modules/connectorRegistry.ts` — already uses ConnectorTarget, verify clean
- `engine/messages/incomingMessages.ts` — already batches by path
- All tools that read `context.descriptor` — use `context.path` + direct agent fields
- Dashboard `agent-types.ts` — use path kind
- 20+ test files — update to path + config

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Create path-based replacements for descriptor ops

New functions that replace descriptor-based operations using path + config:

- [ ] Create `engine/agents/ops/agentPathKind.ts` — `agentPathKind(path): AgentPathKind` (extract from agentSystem's `pathKindResolve` into standalone function)
- [ ] Create `engine/agents/ops/agentPathRoleResolve.ts` — `agentPathRoleResolve(path): ModelRoleKey | null` using `agentPathKind()`
- [ ] Create `engine/agents/ops/agentPathLabel.ts` — `agentPathLabel(path, name?): string` using path kind + optional name
- [ ] Create `engine/agents/ops/agentPathMatchesStrategy.ts` — `agentPathMatchesStrategy(path, strategy): boolean`
- [ ] Create `engine/agents/ops/agentPathConnectorName.ts` — `agentPathConnectorName(path): string | null`
- [ ] Create `engine/agents/ops/agentPathParent.ts` — `agentPathParent(path): AgentPath | null`
- [ ] Create `engine/agents/ops/agentPathUserId.ts` — `agentPathUserId(path): string | null`
- [ ] Write tests for each new function
- [ ] Run tests — must pass before next task

### Task 2: Add AgentCreationConfig to post/resolve flow

The caller provides creation metadata when posting to a path that may create a new agent:

- [ ] Define `AgentCreationConfig` in `agentTypes.ts` — `Partial<AgentConfig>` passed alongside the inbox item
- [ ] Update `agentSystem.post(ctx, target, item, creationConfig?)` signature
- [ ] Update `agentSystem.postAndAwait(ctx, target, item, creationConfig?)` signature
- [ ] Update `resolveEntry()` to accept and use `creationConfig` when creating new agents
- [ ] Ensure existing callers compile (pass `undefined` for now)
- [ ] Write tests for resolveEntry with creation config
- [ ] Run tests — must pass before next task

### Task 3: Change Agent.create() and Agent.restore() to path + config

- [ ] Update `AgentConfig` in `agentConfigTypes.ts` — `{ foreground: boolean; name: string | null; description: string | null; systemPrompt: string | null; workspaceDir: string | null }` (remove `appId`, `connectorUserId`, `username`)
- [ ] Change `Agent.create(ctx, path, config, inbox, agentSystem, userHome)` — remove descriptor param
- [ ] Change `Agent.restore(ctx, path, config, state, inbox, agentSystem, userHome)` — remove descriptor param
- [ ] Replace `this.descriptor` field with `this.path: AgentPath` and `this.config: AgentConfig`
- [ ] Create `agentWrite(storage, ctx, path, config, permissions)` — replaces `agentDescriptorWrite`, writes path + config fields to flat DB columns, emits topography events
- [ ] Update Agent constructor and all internal descriptor references
- [ ] Update `resolveEntry()` to call new `Agent.create()` with path + config (from creationConfig or defaults)
- [ ] Update `restoreAgent()` to call new `Agent.restore()` with path + config from DB record columns
- [ ] Write tests for Agent.create and Agent.restore with new signatures
- [ ] Run tests — must pass before next task

### Task 4: Remove descriptorForPath() and bridge functions

- [ ] Remove `descriptorForPath()` from agentSystem — no longer needed (creation config comes from caller)
- [ ] Remove `agentPathFromDescriptor.ts` — bridge no longer needed
- [ ] Remove `agentConfigFromDescriptor.ts` — bridge no longer needed
- [ ] Remove `connectorTargetIdForUser()` from agentSystem (if only used by descriptorForPath)
- [ ] Remove `resolveUserIdForDescriptor()` — replace with `resolveUserIdForPath(ctx, path)` using `agentPathUserId()`
- [ ] Update `registerEntry()` — remove descriptor from entry type
- [ ] Update `AgentEntry` type — remove `descriptor` field
- [ ] Clean up all references to removed functions
- [ ] Write tests for path-based user resolution
- [ ] Run tests — must pass before next task

### Task 5: Update DB schema — remove descriptor/config columns, add direct fields

- [ ] Make `path` column NOT NULL in migration
- [ ] Add `foreground` INTEGER NOT NULL DEFAULT 0 column
- [ ] Add `name` TEXT column (nullable)
- [ ] Add `description` TEXT column (nullable)
- [ ] Add `system_prompt` TEXT column (nullable)
- [ ] Add `workspace_dir` TEXT column (nullable)
- [ ] Migrate existing `config` JSON values into new columns (extract fields)
- [ ] Drop `type` column from agents table
- [ ] Drop `descriptor` column from agents table
- [ ] Drop `config` column from agents table
- [ ] Update `DatabaseAgentRow` — remove `type`, `descriptor`, `config`; make `path` required; add `foreground`, `name`, `description`, `system_prompt`, `workspace_dir`
- [ ] Update `AgentDbRecord` — remove `type`, `descriptor`, `config`; make `path` required; add `foreground: boolean`, `name: string | null`, `description: string | null`, `systemPrompt: string | null`, `workspaceDir: string | null`
- [ ] Update `agentsRepository.ts` — remove descriptor/config serialization; read/write individual columns
- [ ] Update `CreateAgentInput` if needed
- [ ] Write tests for repository with new schema
- [ ] Run tests — must pass before next task

### Task 6: Update all agent creation call sites

Each caller provides its own creation fields:

- [ ] `permanentAgentToolBuild.ts` — pass `{ name, description, systemPrompt, workspaceDir }` as creation fields
- [ ] `background.ts` (start_background_agent) — pass `{ name }` as creation fields
- [ ] `memoryWorker.ts` — pass `{}` for memory-agent, `{ name: "memory-search" }` for search
- [ ] `crons.ts` — pass `{ name: cronTask.name }` as creation fields
- [ ] `taskExecutions.ts` — pass `{}` as creation fields
- [ ] Subuser creation in `subusers.ts` — pass `{ name, systemPrompt }` as creation fields
- [ ] Swarm creation — pass appropriate fields
- [ ] Update any remaining callers of `agentSystem.post()` that may trigger creation
- [ ] Write tests for each creation site
- [ ] Run tests — must pass before next task

### Task 7: Update all descriptor readers

Replace `context.descriptor.type` and `context.descriptor.*` reads with path + config:

- [ ] Update tool contexts: `context.descriptor` → `context.path` + `context.config`
- [ ] Update `sayTool.ts` — use `context.config.foreground` instead of descriptor.type === "user"
- [ ] Update `sendUserMessageTool.ts` — use `config.foreground` for foreground resolution
- [ ] Update `agentModelSetToolBuild.ts` — use path kind
- [ ] Update `userProfileUpdateTool.ts` — use path kind
- [ ] Update Telegram plugin `systemPrompt()` — check `agentPathConnectorName(path) === "telegram"`
- [ ] Update `messageBuildUserFacing.ts` — use path + config for labels
- [ ] Update `agentSystem.sleepIfIdle()` — use path kind for memory agent detection
- [ ] Update `agentSystem.postToUserAgents()` — filter by `entry.config.foreground === true`
- [ ] Update `agentSystem.agentFor()` — filter by `entry.config.foreground`, sort by connector name from path
- [ ] Update any remaining descriptor.type checks throughout codebase
- [ ] Write tests for critical path-based lookups
- [ ] Run tests — must pass before next task

### Task 8: Delete all descriptor files

- [ ] Delete `agentDescriptorTypes.ts`
- [ ] Delete `agentDescriptorCacheKey.ts`
- [ ] Delete `agentDescriptorRead.ts`
- [ ] Delete `agentDescriptorWrite.ts`
- [ ] Delete `agentDescriptorLabel.ts`
- [ ] Delete `agentDescriptorRoleResolve.ts`
- [ ] Delete `agentDescriptorTargetResolve.ts`
- [ ] Delete `agentDescriptorMatchesStrategy.ts`
- [ ] Delete `agentAppFolderPathResolve.ts` (if no longer used)
- [ ] Delete all corresponding `.spec.ts` files
- [ ] Remove `AgentDescriptor` from `types.ts` re-exports
- [ ] Add `AgentPath`, `AgentPathKind` to `types.ts` re-exports (keep `AgentConfig`)
- [ ] Clean up all remaining imports of deleted files
- [ ] Run tests — must pass before next task

### Task 9: Update dashboard and test files

- [ ] Update `daycare-dashboard/lib/agent-types.ts` — derive `AgentType` from path kind
- [ ] Update `agentSystem.spec.ts` — all test setups use path + config
- [ ] Update `agent.spec.ts` — use new create/restore signatures
- [ ] Update `memoryWorker.spec.ts` — use paths
- [ ] Update `crons.spec.ts` — use paths
- [ ] Update `taskExecutions.spec.ts` — use paths
- [ ] Update `connector.spec.ts` files — verify path emission
- [ ] Update `background.spec.ts` — subagent creation with config
- [ ] Update all other spec files that create descriptor literals
- [ ] Run full test suite
- [ ] Run linter — all issues must be fixed

### Task 10: Verify acceptance criteria
- [ ] `grep -r "AgentDescriptor" sources/` returns zero matches (except migration comments)
- [ ] `grep -r "descriptor\." sources/` returns no descriptor field access on agents
- [ ] All agent types creatable by posting to path with creation fields
- [ ] Connector agents created on first message with foreground=true
- [ ] Subagents created with caller-provided name field
- [ ] Permanent agents created with full fields (name, systemPrompt, etc.)
- [ ] Memory/search agents created with minimal fields
- [ ] Path is sole identity — no descriptor-based routing remains
- [ ] Run full test suite
- [ ] Run linter — all issues must be fixed

### Task 11: [Final] Update documentation
- [ ] Update plan file with any deviations
- [ ] Update `doc/internals/agent-types.md` — document path + config model
- [ ] Remove references to descriptors from plugin READMEs

## Technical Details

### AgentConfig — updated type
```typescript
type AgentConfig = {
    foreground: boolean;
    name: string | null;
    description: string | null;
    systemPrompt: string | null;
    workspaceDir: string | null;
};
```

All fields are stored as flat columns on the `agents` table (no JSON blob). Repository maps between `AgentConfig` and DB columns. `appId`, `connectorUserId`, and `username` are removed entirely.

### Agent.create() — new signature
```typescript
static async create(
    ctx: Context,
    path: AgentPath,
    config: AgentConfig,
    inbox: AgentInbox,
    agentSystem: AgentSystem,
    userHome: UserHome
): Promise<Agent>
```

### AgentCreationConfig
```typescript
type AgentCreationConfig = Partial<AgentConfig>;
```

### Creation config flow
```typescript
// Connector: declares foreground
agentSystem.post(ctx, { path: agentPathConnector(userId, "telegram") }, inboxItem, {
    foreground: true
});
// → resolveEntry creates agent with foreground: true, all other fields null

// Subagent: caller provides name
agentSystem.post(ctx, { path: subPath }, inboxItem, { name: "researcher" });
// → resolveEntry creates agent with name: "researcher", foreground: false

// Permanent agent: caller provides full fields
agentSystem.post(ctx, { path: agentPathAgent(userId, "claude") }, inboxItem, {
    name: "claude",
    description: "General assistant",
    systemPrompt: "You are Claude..."
});
```

### agentWrite() — replaces agentDescriptorWrite()
```typescript
async function agentWrite(
    storage: Storage,
    ctx: Context,
    path: AgentPath,
    config: AgentConfig,
    defaultPermissions: SessionPermissions
): Promise<void> {
    // Writes path + config fields as flat DB columns
    // Emits topography observation events
    // No descriptor, no type column, no config JSON blob
}
```

### DB schema (final)
```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY NOT NULL,
    path TEXT NOT NULL,
    foreground INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    description TEXT,
    system_prompt TEXT,
    workspace_dir TEXT,
    next_sub_index INTEGER NOT NULL DEFAULT 0,
    user_id TEXT NOT NULL,
    active_session_id TEXT,
    permissions TEXT NOT NULL,
    tokens TEXT,
    stats TEXT NOT NULL DEFAULT '{}',
    lifecycle TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_agents_path ON agents (path);
```

## Post-Completion

**Manual verification:**
- Test Telegram bot — connector agents created on first message
- Test subagent spawning — name column set from caller
- Test permanent agent creation — all field columns persisted
- Test memory worker — memory/search agents with null fields
- Test cron/task — agents created on schedule

**Deferred:**
- Field updates (if ever needed — currently set-once at creation)
- Path-based permissions (read/write scoped to path subtrees)
