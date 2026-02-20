# Storage Repository Rewrite

## Overview
Rewrite the storage layer from ~20 individual `domainDbVerb()` functions (each opening/closing SQLite) into a repository-style `Storage` class with entity-specific repositories. The new design uses a single persistent SQLite connection, write-through in-memory caching (for users and agents), and prisma-style method naming (`findById`, `findMany`, `create`, `update`, `delete`). Session history remains uncached (queried from DB directly).

The `Storage` class becomes the single entry point for all SQLite access, replacing the current pattern of passing `Config` to individual functions.

## Context
- **Current pattern:** `agentDbRead(config, id)`, `userDbWrite(config, record)` etc. — stateless functions, each opens/closes DB
- **Tables:** `users`, `user_connector_keys`, `agents`, `sessions`, `session_history`
- **Consumers:** `AgentSystem`, `Agent`, `agentStateRead/Write`, `agentDescriptorRead/Write`, `agentHistoryLoad/Append`, `agentBackgroundList`, `agentList`, `userHomeMigrate`
- **Existing tests:** `agentDb.spec.ts`, `sessionDb.spec.ts`, `sessionHistoryDb.spec.ts`, `userDb.spec.ts`, `storageUpgrade.spec.ts`, `databaseOpen.spec.ts`
- **Migration system:** kept intact, runs on `Storage` init

## Target Architecture

```
Storage                          (facade: owns connection + repositories)
├── users: UsersRepository       (cached: Map<id, UserWithConnectorKeys>)
├── agents: AgentsRepository     (cached: Map<id, AgentDbRecord>)
├── sessions: SessionsRepository (no cache)
└── history: HistoryRepository   (no cache)
```

### Storage class (high-level orchestration)

```typescript
class Storage {
    readonly users: UsersRepository;
    readonly agents: AgentsRepository;
    readonly sessions: SessionsRepository;
    readonly history: HistoryRepository;

    static open(dbPath: string): Storage;          // opens connection, runs migrations
    close(): void;                                  // closes connection

    // Higher-level transaction-style operations
    async createUser(input: CreateUserInput): Promise<UserWithConnectorKeysDbRecord>;
    async resolveUserByConnectorKey(connectorKey: string): Promise<UserWithConnectorKeysDbRecord>;
    async createAgentWithSession(input: CreateAgentInput): Promise<{ agent: AgentDbRecord; sessionId: string }>;
    async appendHistory(agentId: string, record: AgentHistoryRecord): Promise<void>;  // auto-creates session if needed
}
```

### Repository methods (prisma-style naming)

```typescript
// UsersRepository
findById(id: string): Promise<UserWithConnectorKeysDbRecord | null>;
findByConnectorKey(key: string): Promise<UserWithConnectorKeysDbRecord | null>;
findMany(): Promise<UserWithConnectorKeysDbRecord[]>;
findOwner(): Promise<UserWithConnectorKeysDbRecord | null>;
create(input: CreateUserInput): Promise<UserWithConnectorKeysDbRecord>;
update(id: string, data: UpdateUserInput): Promise<void>;
delete(id: string): Promise<void>;
addConnectorKey(userId: string, connectorKey: string): Promise<void>;

// AgentsRepository
findById(id: string): Promise<AgentDbRecord | null>;
findMany(): Promise<AgentDbRecord[]>;
create(input: AgentDbRecord): Promise<void>;
update(id: string, data: Partial<AgentDbRecord>): Promise<void>;

// SessionsRepository
findById(id: string): Promise<SessionDbRecord | null>;
findByAgentId(agentId: string): Promise<SessionDbRecord[]>;
create(input: CreateSessionInput): Promise<string>;

// HistoryRepository
findBySessionId(sessionId: string): Promise<AgentHistoryRecord[]>;
findByAgentId(agentId: string): Promise<AgentHistoryRecord[]>;
append(sessionId: string, record: AgentHistoryRecord): Promise<void>;
```

### Cache strategy
- **Users:** write-through `Map<string, UserWithConnectorKeysDbRecord>` + `Map<string, string>` for connectorKey→userId lookups. Populated on write, invalidated on delete. `findMany()`/`findOwner()` always go through cache when warm.
- **Agents:** write-through `Map<string, AgentDbRecord>`. Populated on read/write. `findMany()` fills entire cache.
- **Sessions & History:** no cache (sessions are small reads; history is unbounded append-only).

### Concurrency safety
Each cached repository uses **per-entity-id locks** (`Map<string, AsyncLock>`) to protect read-modify-write sequences and cache updates without blocking unrelated entities. This prevents race conditions while maximizing throughput — operations on different agents/users run fully in parallel.

- **UsersRepository:** `Map<string, AsyncLock>` keyed by user id. Mutating operations (`update`, `delete`, `addConnectorKey`) acquire the lock for that specific user id. `create` uses a separate global `AsyncLock` only for the insert (since the id doesn't exist yet). Read-only cache hits (`findById` when cached) are lock-free.
- **AgentsRepository:** `Map<string, AsyncLock>` keyed by agent id. `update` and cache-miss `findById` (DB read + cache populate) acquire the lock for that agent id. `create` uses a separate global `AsyncLock` for the insert. Cached reads are lock-free.
- **High-level Storage operations** (`resolveUserByConnectorKey`, `createAgentWithSession`, `appendHistory`) use the repository-level per-id locks internally — no additional lock needed at the Storage facade level. `resolveUserByConnectorKey` uses a `Map<string, AsyncLock>` keyed by connector key to prevent duplicate user creation for the same connector identity.
- **SessionsRepository & HistoryRepository:** no locks needed (no cache, SQLite handles row-level atomicity).
- Lock maps use lazy creation (lock created on first access for an id) and are never cleaned up (objects live forever per project convention).

### Connection lifecycle
- Single `DatabaseSync` instance, opened in `Storage.open()`, closed in `Storage.close()`
- Migrations run once during `open()`
- All repositories share the same connection reference

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change
- Maintain backward compatibility during migration (old functions can be thin wrappers during transition)

## Implementation Steps

### Task 1: Create Storage class with connection management
- [ ] Create `sources/storage/storage.ts` with `Storage` class
- [ ] `static open(dbPath: string): Storage` — opens `DatabaseSync`, runs migrations, returns instance
- [ ] `close(): void` — closes the connection
- [ ] Expose `db` getter for repositories to access the connection
- [ ] Write tests for `Storage.open()` with `:memory:` db — verifies migrations run and tables exist
- [ ] Write tests for `Storage.close()` — verifies connection closed
- [ ] Run tests — must pass before next task

### Task 2: Create UsersRepository with cache
- [ ] Create `sources/storage/usersRepository.ts` with `UsersRepository` class
- [ ] Implement `findById(id)` — check cache first, query DB on miss, populate cache
- [ ] Implement `findByConnectorKey(key)` — use connectorKey→userId index, then `findById`
- [ ] Implement `findMany()` — query all, populate cache
- [ ] Implement `findOwner()` — scan cache or query
- [ ] Implement `create(input)` — INSERT user, populate cache, return record
- [ ] Implement `update(id, data)` — UPDATE user, update cache
- [ ] Implement `delete(id)` — DELETE user + cascade, remove from cache
- [ ] Implement `addConnectorKey(userId, key)` — INSERT key, update cache entry
- [ ] Wire `UsersRepository` into `Storage` class
- [ ] Write tests for all CRUD operations (success cases)
- [ ] Write tests for cache behavior (cache hit, cache miss, invalidation on delete)
- [ ] Write tests for connector key operations
- [ ] Run tests — must pass before next task

### Task 3: Create AgentsRepository with cache
- [ ] Create `sources/storage/agentsRepository.ts` with `AgentsRepository` class
- [ ] Implement `findById(id)` — cache-first, DB fallback
- [ ] Implement `findMany()` — query all, fill cache
- [ ] Implement `create(record)` — INSERT/UPSERT, populate cache
- [ ] Implement `update(id, data)` — read-merge-write, update cache
- [ ] Wire `AgentsRepository` into `Storage` class
- [ ] Write tests for all CRUD operations
- [ ] Write tests for cache behavior (hit/miss/update)
- [ ] Run tests — must pass before next task

### Task 4: Create SessionsRepository (no cache)
- [ ] Create `sources/storage/sessionsRepository.ts` with `SessionsRepository` class
- [ ] Implement `findById(id)` — direct query
- [ ] Implement `findByAgentId(agentId)` — list sessions for agent
- [ ] Implement `create(input)` — INSERT, return generated id
- [ ] Wire `SessionsRepository` into `Storage` class
- [ ] Write tests for create + find operations
- [ ] Run tests — must pass before next task

### Task 5: Create HistoryRepository (no cache)
- [ ] Create `sources/storage/historyRepository.ts` with `HistoryRepository` class
- [ ] Implement `findBySessionId(sessionId)` — ordered query
- [ ] Implement `findByAgentId(agentId)` — cross-session join query
- [ ] Implement `append(sessionId, record)` — INSERT one row
- [ ] Wire `HistoryRepository` into `Storage` class
- [ ] Write tests for append + find operations
- [ ] Run tests — must pass before next task

### Task 6: Add high-level operations to Storage
- [ ] Implement `Storage.createUser(input)` — creates user row + optional connector key in one logical operation
- [ ] Implement `Storage.resolveUserByConnectorKey(key)` — find-or-create user for a connector key
- [ ] Implement `Storage.createAgentWithSession(input)` — creates agent + initial session atomically
- [ ] Implement `Storage.appendHistory(agentId, record)` — looks up active session (from agents cache), auto-creates session if needed, appends record
- [ ] Write tests for each high-level operation
- [ ] Write tests for edge cases (duplicate connector key race, missing agent)
- [ ] Run tests — must pass before next task

### Task 7: Wire Storage into engine — replace Config-based access
- [ ] Add `storage: Storage` to `AgentSystemOptions` and `AgentSystem` constructor
- [ ] Open `Storage` in the engine bootstrap (where `storageUpgrade` currently runs) and pass it through
- [ ] Update `AgentSystem.load()` to use `storage.agents.findMany()` instead of `agentDbList(config)`
- [ ] Update `AgentSystem.resolveUserIdForConnectorKey()` to use `storage.resolveUserByConnectorKey()`
- [ ] Update `AgentSystem.ownerUserIdEnsure()` to use `storage.users.findOwner()` / `storage.users.create()`
- [ ] Update `AgentSystem.agentContextForAgentId()` to use `storage.agents.findById()`
- [ ] Update remaining `AgentSystem` methods that use direct storage imports
- [ ] Run tests — must pass before next task

### Task 8: Wire Storage into Agent class and ops
- [ ] Update `Agent.create()` to use `storage.createAgentWithSession()` or individual repository calls
- [ ] Update `Agent.handleReset()` to use `storage.sessions.create()`
- [ ] Update `agentStateRead` to use `storage.agents.findById()` + `storage.sessions.findById()`
- [ ] Update `agentStateWrite` to use `storage.agents.update()`
- [ ] Update `agentDescriptorRead` to use `storage.agents.findById()`
- [ ] Update `agentDescriptorWrite` to use `storage.agents.create()` / `storage.agents.update()`
- [ ] Update `agentHistoryLoad` to use `storage.history.findBySessionId()`
- [ ] Update `agentHistoryAppend` to use `storage.appendHistory()`
- [ ] Update `agentHistoryLoadAll` to use `storage.history.findByAgentId()`
- [ ] Update `agentBackgroundList` and `agentList` to use `storage.agents.findMany()`
- [ ] Run tests — must pass before next task

### Task 9: Remove old storage functions
- [ ] Delete individual `agentDbRead.ts`, `agentDbWrite.ts`, `agentDbList.ts`, `agentDbParse.ts` files
- [ ] Delete individual `userDbRead.ts`, `userDbWrite.ts`, `userDbList.ts`, `userDbDelete.ts`, `userDbReadByConnectorKey.ts`, `userDbConnectorKeyAdd.ts`, `userDbParse.ts` files
- [ ] Delete individual `sessionDbRead.ts`, `sessionDbCreate.ts`, `sessionDbListForAgent.ts`, `sessionDbParse.ts` files
- [ ] Delete individual `sessionHistoryDbLoad.ts`, `sessionHistoryDbLoadAll.ts`, `sessionHistoryDbAppend.ts`, `sessionHistoryRecordParse.ts` files
- [ ] Delete `databaseOpenEnsured.ts` (replaced by `Storage.open()`)
- [ ] Keep `databaseOpen.ts` (used internally by `Storage.open()`)
- [ ] Keep `databaseTypes.ts` (types still needed)
- [ ] Keep `storageUpgrade.ts` (or inline into Storage.open)
- [ ] Keep migration files (unchanged)
- [ ] Remove old test files (`agentDb.spec.ts`, `userDb.spec.ts`, `sessionDb.spec.ts`, `sessionHistoryDb.spec.ts`) — replaced by repository tests
- [ ] Update `@/types` re-exports if any storage types moved
- [ ] Verify no remaining imports of deleted files
- [ ] Run full test suite — must pass before next task

### Task 10: Verify acceptance criteria
- [ ] Verify all repositories implement prisma-style naming
- [ ] Verify write-through cache works for users and agents
- [ ] Verify single persistent connection (no open/close per operation)
- [ ] Verify high-level operations on Storage work end-to-end
- [ ] Run full test suite (unit tests)
- [ ] Run linter — all issues must be fixed
- [ ] Verify no remaining references to old storage functions

### Task 11: Update documentation
- [ ] Update `doc/STORAGE.md` to reflect repository pattern
- [ ] Update any relevant plan docs

## Technical Details

### File layout after rewrite
```
sources/storage/
  storage.ts                    # Storage class (facade)
  usersRepository.ts            # UsersRepository
  usersRepository.spec.ts
  agentsRepository.ts           # AgentsRepository
  agentsRepository.spec.ts
  sessionsRepository.ts         # SessionsRepository
  sessionsRepository.spec.ts
  historyRepository.ts          # HistoryRepository
  historyRepository.spec.ts
  databaseOpen.ts               # kept: low-level connection
  databaseOpen.spec.ts          # kept
  databaseTypes.ts              # kept: row types + record types
  storageUpgrade.ts             # kept or inlined
  storageUpgrade.spec.ts        # kept
  userConnectorKeyCreate.ts     # kept: pure utility
  userConnectorKeyCreate.spec.ts
  migrations/                   # kept: all migration files unchanged
```

### Type changes
- `AgentDbRecord`, `UserDbRecord`, `SessionDbRecord` etc. stay in `databaseTypes.ts`
- New input types (`CreateUserInput`, `UpdateUserInput`, `CreateSessionInput`, `CreateAgentInput`) added to `databaseTypes.ts`
- Parse functions (`agentDbParse`, `userDbParse`, `sessionDbParse`, `sessionHistoryRecordParse`) move into their respective repository files as private methods

### How Storage is passed
- `Storage` instance created during engine bootstrap (in `startEngine` or equivalent)
- Passed into `AgentSystem` via `AgentSystemOptions.storage`
- `AgentSystem` exposes it (or passes it) to `Agent` and ops functions
- Ops functions change signature from `(config: Config, ...)` to `(storage: Storage, ...)`

### Cache warming
- On `Storage.open()`: no preload (lazy)
- On `AgentSystem.load()`: calls `storage.agents.findMany()` which fills agent cache
- User cache fills on first access per user

## Post-Completion

**Manual verification:**
- Run the full application (`yarn dev`) and verify agents load, messages process, sessions reset
- Verify multi-user connector key resolution works end-to-end
