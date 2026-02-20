# Storage Types Reference Document

## Overview
- Create a comprehensive reference document (`doc/STORAGE.md`) listing every type persisted to disk
- Each entry includes full TypeScript type definitions, nested types, storage format, file paths, and example values
- Includes Mermaid ER diagrams for SQLite tables and relationship diagrams for JSON/file types
- Serves as the single source of truth for understanding the persistence layer

## Context (from discovery)
- **5 storage mechanisms**: SQLite, JSON files, JSONL append files, Markdown+frontmatter, PGlite
- **29+ persisted types** across `storage/`, `engine/`, `plugins/`, `auth/`, `files/`, `config/`
- Existing docs live in `doc/` (internals, concepts); plan files in `docs/plans/`
- No existing unified storage reference doc

## Development Approach
- **Testing approach**: Regular (no code changes, doc-only task)
- This is a documentation-only task; no code changes or tests required
- Read source files to extract exact type definitions
- Cross-reference migrations for SQL schemas

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with + prefix
- Document issues/blockers with ! prefix

## Implementation Steps

### Task 1: Document SQLite storage mechanism
- [ ] Read all migration files to extract exact SQL schemas for `agents`, `sessions`, `session_history`, `users`, `user_connector_keys`, `_migrations` tables
- [ ] Read `databaseTypes.ts` for `DatabaseAgentRow`, `AgentDbRecord`, `DatabaseSessionRow`, `SessionDbRecord`, `DatabaseSessionHistoryRow`, `DatabaseUserRow`, `UserDbRecord`, `DatabaseUserConnectorKeyRow`, `UserConnectorKeyDbRecord`
- [ ] Read `agentDescriptorTypes.ts` for full `AgentDescriptor` union type
- [ ] Read `agentTypes.ts` for `AgentHistoryRecord`, `AgentTokenEntry`, `AgentTokenSnapshotSize`, `AgentTokenStats`, `AgentLifecycleState`
- [ ] Read `permissions.ts` for `SessionPermissions`
- [ ] Write SQLite section of `doc/STORAGE.md` with full type defs, SQL schemas, and example values
- [ ] Create Mermaid ER diagram showing SQLite table relationships (agents -> sessions -> session_history, users -> user_connector_keys, agents.user_id -> users)

### Task 2: Document JSON file types
- [ ] Read `auth/store.ts` for `AuthConfig`, `AuthEntry`
- [ ] Read `settings.ts` for `SettingsConfig` and all nested settings types
- [ ] Read `files/types.ts` for `StoredFile`
- [ ] Read `channelTypes.ts` for `Channel`, `ChannelMember`
- [ ] Read `signalTypes.ts` for `Signal`, `SignalSource`
- [ ] Read `delayedSignals.ts` for `DelayedSignal` and store schema
- [ ] Read `exposeTypes.ts` for `ExposeEndpoint`, `ExposeTarget`, `ExposeEndpointAuth`, `ExposeMode`
- [ ] Read `processes.ts` for `ProcessRecord` (internal type)
- [ ] Read `cronTypes.ts` for `CronTaskState`
- [ ] Read `heartbeatTypes.ts` for `HeartbeatState`
- [ ] Read `appPermissionState*.ts` for app permission state type
- [ ] Read `upgradeRestartPendingTypes.ts` for `UpgradeRestartPending`
- [ ] Write JSON files section of `doc/STORAGE.md` with full type defs, file paths, and example values
- [ ] Create Mermaid diagram showing JSON file type relationships

### Task 3: Document JSONL append file types
- [ ] Read `channelStore.ts` for `ChannelMessage` serialization
- [ ] Read `signals.ts` for signal event JSONL format
- [ ] Write JSONL section of `doc/STORAGE.md` with type defs and example lines

### Task 4: Document Markdown+frontmatter types
- [ ] Read `cronFrontmatterParse.ts` and `cronFrontmatterSerialize.ts` for cron task frontmatter
- [ ] Read `heartbeatStore.ts` for heartbeat frontmatter
- [ ] Read `appManifestParse.ts` and `appTypes.ts` for `AppManifest`
- [ ] Read `plugins/memory/store.ts` for memory entity frontmatter
- [ ] Read `skillTypes.ts` and `skillResolve.ts` for `AgentSkill` frontmatter
- [ ] Write Markdown+frontmatter section of `doc/STORAGE.md` with type defs and example files

### Task 5: Document PGlite and summary
- [ ] Read `plugins/database/plugin.ts` for PGlite storage details
- [ ] Write PGlite section of `doc/STORAGE.md`
- [ ] Write overview summary table listing all types, storage mechanism, format, and source file
- [ ] Create top-level Mermaid diagram showing all storage mechanisms and their types
- [ ] Add config paths section documenting how `Config` type wires storage locations

### Task 6: Review and finalize
- [ ] Verify all type definitions match source code exactly
- [ ] Verify all file paths are correct
- [ ] Ensure Mermaid diagrams render correctly
- [ ] Add doc to `doc/README.md` index if one exists
- [ ] Run `yarn typecheck` to confirm no code was accidentally changed

## Technical Details
- **Storage mechanisms**: SQLite (WAL mode, foreign keys), JSON (pretty-print, atomic writes), JSONL (append-only), Markdown (gray-matter), PGlite (embedded Postgres)
- **Key paths**: all derived from `Config` type (`configDir`, `dataDir`, `agentsDir`, `dbPath`, `filesDir`, `authPath`)
- **Validation**: some types use Zod schemas (channels, delayed signals, expose endpoints, app permissions), others are unvalidated JSON

## Post-Completion

**Manual verification:**
- Review rendered Mermaid diagrams in a markdown previewer
- Cross-check with actual files on disk in a running instance
