# Entities, Data Flow & Shapes — Architecture Record

## Overview
- Comprehensive architecture document capturing every major entity, its TypeScript shape, storage representation, and data flow patterns in the daycare system
- Serves as an architecture decision record: snapshot of current state to inform future refactoring
- Includes ASCII data flow diagrams + both TypeScript definitions and summary tables for each entity
- Lives at `doc/entities-data-flow-shapes.md`

## Context (from discovery)
- Central types re-exported from `sources/types.ts` (~40+ types across 15 domain modules)
- SQLite storage with 5 tables: `agents`, `sessions`, `session_history`, `users`, `user_connector_keys`
- 21 distinct entity groups identified: agents, sessions, users, permissions, connectors, plugins, inference, tools, signals, channels, heartbeats, cron, apps, expose, processes, files, config, engine events, inbox items, history records, token tracking
- Plugin system registers: connectors, inference providers, tools, commands, image providers, skills
- Key data flows: message lifecycle, agent lifecycle, signal delivery, permission resolution, user identity resolution

## Development Approach
- **This is a documentation-only task** — no code changes, no tests needed
- Write the document incrementally, one section per task
- Each task produces a complete, self-contained section
- Use ASCII diagrams for flows, TypeScript blocks for shapes, markdown tables for summaries
- Pull exact type definitions from source files — do not paraphrase or guess

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Create document skeleton and write Core Entities section
- [ ] Create `doc/entities-data-flow-shapes.md` with full TOC and document structure
- [ ] Write **Agent** section: `AgentDescriptor` (discriminated union, all 6 variants), `AgentState`, `AgentLifecycleState`, `AgentDbRecord` — TypeScript blocks + summary table
- [ ] Write **Session** section: `SessionDbRecord` — TypeScript block + summary table
- [ ] Write **User & Identity** section: `UserDbRecord`, `UserConnectorKeyDbRecord`, `UserWithConnectorKeysDbRecord`, `AgentContext` class — TypeScript blocks + summary tables
- [ ] Write **Permissions** section: `SessionPermissions`, `PermissionKind`, `PermissionAccess` (discriminated union), `PermissionRequest`, `PermissionDecision` — TypeScript blocks + summary tables

### Task 2: Write Storage Layer section
- [ ] Write **SQLite Schema** section: all 5 tables (`agents`, `sessions`, `session_history`, `users`, `user_connector_keys`) with column definitions, types, constraints, foreign keys
- [ ] Write **DB Record ↔ Runtime mapping** table showing how each DB column maps to TypeScript fields (JSON-serialized columns vs direct columns)
- [ ] Write **Storage patterns** section: WAL mode, foreign keys, migration system, JSONL vs SQLite for different data
- [ ] Draw ASCII diagram: persistence topology (what lives in SQLite vs filesystem vs in-memory)

### Task 3: Write Message & Connector System section
- [ ] Write **Connector** section: `Connector` interface, `ConnectorCapabilities`, `ConnectorMessage`, `ConnectorFile`, `MessageContext` — TypeScript blocks + summary tables
- [ ] Write **Inbox Items** section: `AgentInboxItem` (discriminated union, all 6 variants), `AgentInboxSteering` — TypeScript blocks + summary table
- [ ] Write **History Records** section: `AgentHistoryRecord` (discriminated union, all 9 variants) — TypeScript blocks + summary table
- [ ] Draw ASCII diagram: message flow from external connector → debounce → agent inbox → inference loop → response delivery

### Task 4: Write Plugin & Inference System section
- [ ] Write **Plugin** section: `PluginModule`, `PluginApi`, `PluginInstance`, `PluginRegistrar`, `PluginInstanceSettings` — TypeScript blocks + summary tables
- [ ] Write **Inference** section: `InferenceProvider`, `InferenceClient`, `InferenceProviderOptions` — TypeScript blocks + summary tables
- [ ] Write **Tool** section: `ToolDefinition`, `ToolExecutionContext`, `ToolResultContract` — TypeScript blocks + summary tables
- [ ] Draw ASCII diagram: plugin lifecycle (load → register connectors/tools/providers → preStart → postStart)

### Task 5: Write Supporting Systems section
- [ ] Write **Signal** section: `Signal`, `SignalSource`, `SignalSubscription`, `DelayedSignal` — TypeScript blocks + summary tables
- [ ] Write **Channel** section: `Channel`, `ChannelMember`, `ChannelMessage`, `ChannelSignalData` — TypeScript blocks + summary tables
- [ ] Write **Heartbeat** section: `HeartbeatDefinition`, `HeartbeatCreateTaskArgs` — TypeScript blocks + summary tables
- [ ] Write **Cron** section: `CronTaskDefinition`, `CronTaskWithPaths`, `ExecGateDefinition` — TypeScript blocks + summary tables

### Task 6: Write Apps, Expose, Processes, Files & Config section
- [ ] Write **App** section: `AppDescriptor`, `AppManifest`, `AppPermissions`, `AppRule` — TypeScript blocks + summary tables
- [ ] Write **Expose** section: `ExposeEndpoint`, tunnel providers — TypeScript blocks + summary table
- [ ] Write **Process** section: `ProcessCreateInput`, `ProcessInfo`, sandbox runtime — TypeScript blocks + summary tables
- [ ] Write **Files** section: `StoredFile`, `FileReference`, `ConnectorFile` — TypeScript blocks + summary tables
- [ ] Write **Config** section: `Config`, `SettingsConfig` — TypeScript blocks + summary tables

### Task 7: Write Data Flow Diagrams section
- [ ] Draw ASCII diagram: **Agent lifecycle** — creation → active → sleeping → wake → dead, with triggers at each transition
- [ ] Draw ASCII diagram: **User identity resolution** — connector message → connector key lookup → user creation/association → AgentContext
- [ ] Draw ASCII diagram: **Signal delivery** — signal emit → pattern match → subscription lookup → agent inbox delivery (including delayed signals)
- [ ] Draw ASCII diagram: **Permission resolution** — tool requests permission → permission request registry → connector approval → permission apply
- [ ] Draw ASCII diagram: **Engine wiring** — top-level component ownership and dependency graph (Engine → AgentSystem, ModuleRegistry, PluginManager, etc.)

### Task 8: Write Token Tracking & Engine Events section
- [ ] Write **Token Tracking** section: `AgentTokenSize`, `AgentTokenEntry`, `AgentTokenStats` — TypeScript blocks + summary tables
- [ ] Write **Engine Events** section: `EngineEvent`, catalog of all known event types with payload shapes
- [ ] Write **Skills** section: `AgentSkill` — TypeScript block + summary table

### Task 9: Write Entity Relationship Overview
- [ ] Draw master ASCII entity-relationship diagram showing all entities and their connections (FK relationships, signal flows, ownership)
- [ ] Write **Cross-cutting concerns** section: how `userId` threads through agents → tools → signals → cron
- [ ] Write **Discriminated unions catalog** — list all discriminated unions in one place with their type field and variants
- [ ] Final review pass: verify all types match current source, fix any drift

### Task 10: Final review and cleanup
- [ ] Verify document TOC matches actual sections
- [ ] Verify all TypeScript blocks are accurate against source files
- [ ] Verify all ASCII diagrams are readable and consistent in style
- [ ] Add "Last updated" timestamp and source file references for each entity

## Technical Details

### Document structure
```
doc/entities-data-flow-shapes.md
├── 1. Overview & Reading Guide
├── 2. Entity Relationship Overview (master diagram)
├── 3. Core Entities
│   ├── 3.1 Agent (AgentDescriptor, AgentState, AgentDbRecord)
│   ├── 3.2 Session (SessionDbRecord)
│   ├── 3.3 User & Identity (UserDbRecord, AgentContext)
│   └── 3.4 Permissions (SessionPermissions, PermissionRequest)
├── 4. Storage Layer
│   ├── 4.1 SQLite Schema
│   ├── 4.2 DB ↔ Runtime Mapping
│   └── 4.3 Persistence Topology
├── 5. Message & Connector System
│   ├── 5.1 Connector Interface
│   ├── 5.2 Inbox Items
│   ├── 5.3 History Records
│   └── 5.4 Message Flow Diagram
├── 6. Plugin & Inference System
│   ├── 6.1 Plugin Lifecycle
│   ├── 6.2 Inference Providers
│   └── 6.3 Tool Definitions
├── 7. Supporting Systems
│   ├── 7.1 Signals
│   ├── 7.2 Channels
│   ├── 7.3 Heartbeats
│   └── 7.4 Cron
├── 8. Apps, Expose, Processes, Files & Config
├── 9. Data Flow Diagrams
│   ├── 9.1 Agent Lifecycle
│   ├── 9.2 User Identity Resolution
│   ├── 9.3 Signal Delivery
│   ├── 9.4 Permission Resolution
│   └── 9.5 Engine Wiring
├── 10. Token Tracking & Engine Events
└── 11. Cross-cutting Concerns & Discriminated Unions Catalog
```

### ASCII diagram style guide
- Use box-drawing characters: `┌ ┐ └ ┘ │ ─ ├ ┤ ┬ ┴ ┼`
- Arrows: `→ ← ↑ ↓ ↔`
- Max width: 100 characters
- Label all arrows with the action/data being passed

### Source file references
Each entity section will include `Source: path/to/file.ts:line` so readers can jump to current definitions.

## Post-Completion

**Maintenance:**
- This document will drift as the codebase evolves; re-run entity discovery periodically
- When adding new entity types, update the corresponding section and the master ER diagram
- Consider generating parts of this document from source via tooling in the future
