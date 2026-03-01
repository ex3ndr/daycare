# Comprehensive App API

## Overview

Build out the App Server HTTP API (`packages/daycare/sources/api/`) to provide the mobile/web app with full access to all core Daycare features. Currently the app server only exposes auth, documents, prompts, costs, and a read-only task listing. This plan adds five new API domains and wires them through the existing `AppServer` → `apiRouteHandle` dispatch chain.

**Deliverables:**
- User profile/settings endpoints (read + update)
- Agent listing endpoint
- Agent history, message sending, and SSE event stream
- Full task CRUD + trigger management + manual execution
- Skill listing with content retrieval

**Verification:** Each new route group gets unit tests for handler logic. All endpoints follow the existing `{ ok: true, ... }` / `{ ok: false, error }` response convention with user-scoped `ctx`.

## Context

**Existing app server architecture:**
- Native Node.js `http.createServer()` in `api/app-server/appServer.ts`
- JWT Bearer auth via `appAuthExtract.ts` → `contextForUser({ userId })`
- Central dispatcher `api/routes/routes.ts` → domain route handlers
- HTTP utilities: `appSendJson`, `appReadJsonBody`, `appCorsApply` in `appHttp.ts`
- Response format: `{ ok: true, ... }` or `{ ok: false, error: "..." }`

**Existing routes:**
- `/auth/*` — token validation, refresh, telegram exchange
- `/prompts/*` — CRUD for 4 knowledge files
- `/tasks/active` — read-only active task listing
- `/costs/token-stats` — hourly token usage stats
- `/documents/*` — full CRUD + tree (already complete, skipped)
- `/v1/webhooks/:token` — webhook trigger (unauthenticated)

**Key dependencies to wire through `AppServerOptions` → `ApiRouteContext`:**
- `storage.users` — UsersRepository (profile read/update)
- `storage.agents` — AgentsRepository (agent listing)
- `storage.history` — HistoryRepository (agent history)
- `storage.tasks` / `storage.cronTasks` / `storage.webhookTasks` — task CRUD
- `agentSystem.post()` — send messages to agents
- `eventBus.onEvent()` — SSE subscription
- `Skills.list()` — skill enumeration + fs read for content
- `crons` / `webhooks` — trigger management
- `taskExecutions` — manual task execution

**Engine wiring point:** `engine.ts` lines 381–391 construct `AppServer` with options. New dependencies are added here and flow through `ApiRouteContext`.

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility with existing routes

## Testing Strategy
- **Unit tests**: required for every route handler (pure function with input → result)
- Follow existing pattern: `*.spec.ts` next to the file under test
- Tests use in-memory PGlite (`:memory:`) where storage is needed
- Test both success and error/validation paths

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Extend AppServerOptions and ApiRouteContext with new dependencies

Wire new engine dependencies into the app server so route handlers can access them.

- [x] Add new fields to `AppServerOptions` in `appServer.ts`:
  - `users: UsersRepository | null` — user profile read/update
  - `agentList: (ctx: Context) => Promise<AgentListItem[]>` — list agents for user
  - `agentHistoryLoad: (ctx: Context, agentId: string, limit?: number) => Promise<AgentHistoryRecord[]>` — load agent history
  - `agentPost: (ctx: Context, target: AgentPostTarget, item: AgentInboxItem) => Promise<void>` — send message
  - `eventBus: EngineEventBus | null` — SSE events
  - `skills: { list: () => Promise<AgentSkill[]> } | null` — skill listing
  - `tasksCreate: (ctx, input) => Promise<TaskDbRecord>` — create task
  - `tasksRead: (ctx, taskId) => Promise<TaskDbRecord | null>` — read single task
  - `tasksUpdate: (ctx, taskId, input) => Promise<TaskDbRecord | null>` — update task
  - `tasksDelete: (ctx, taskId) => Promise<boolean>` — delete task
  - `tasksRun: (ctx, taskId, params) => Promise<TaskRunResult>` — execute task
  - `cronTriggerAdd: (ctx, taskId, input) => Promise<CronTriggerResult>` — add cron trigger
  - `cronTriggerRemove: (ctx, taskId) => Promise<number>` — remove cron triggers
  - `webhookTriggerAdd: (ctx, taskId, input) => Promise<WebhookTriggerResult>` — add webhook trigger
  - `webhookTriggerRemove: (ctx, taskId) => Promise<number>` — remove webhook triggers
- [x] Add matching fields to `ApiRouteContext` in `routes/routes.ts`
- [x] Pass new dependencies through `requestHandle()` → `apiRouteHandle()`
- [x] Wire dependencies in `engine.ts` constructor where `AppServer` is created (lines 381–391), using callbacks that delegate to `storage`, `agentSystem`, `crons`, `webhooks`, `taskExecutions`, and `Skills`
- [x] Verify existing routes still work (typecheck passes)
- [x] Run tests — must pass before next task

### Task 2: User profile/settings API

Add `GET /profile` and `POST /profile/update` endpoints for reading and updating the authenticated user's profile.

- [x] Create `api/routes/profile/profileRead.ts`:
  - Input: `{ ctx: Context, users: UsersRepository }`
  - Reads user by `ctx.userId` from `users.findById()`
  - Returns `{ ok: true, profile: { firstName, lastName, bio, about, country, timezone, systemPrompt, memory, nametag } }`
  - Returns `{ ok: false, error: "User not found." }` if missing
- [x] Create `api/routes/profile/profileUpdate.ts`:
  - Input: `{ ctx, users, body }` where body contains optional fields: `firstName`, `lastName`, `bio`, `about`, `country`, `timezone`, `systemPrompt`, `memory`
  - Validates types (strings or null for text fields, boolean for memory)
  - Calls `users.update(ctx.userId, { ...fields, updatedAt: Date.now() })`
  - Returns updated profile (re-read after write)
  - Returns `{ ok: false, error }` on validation failure
- [x] Create `api/routes/profile/profileRoutes.ts`:
  - `GET /profile` → `profileRead`
  - `POST /profile/update` → parse body → `profileUpdate`
  - Returns `true` if handled, `false` otherwise
- [x] Register `/profile` prefix in `routes.ts` dispatcher
- [x] Write tests for `profileRead` (user found, user not found)
- [x] Write tests for `profileUpdate` (valid update, partial update, invalid types, user not found)
- [x] Run tests — must pass before next task

### Task 3: Agent listing API

Add `GET /agents` endpoint that returns all agents belonging to the authenticated user.

- [x] Create `api/routes/agents/agentsList.ts`:
  - Input: `{ ctx, agentList callback }`
  - Calls `agentList(ctx)` callback
  - Returns `{ ok: true, agents: [{ agentId, descriptor, lifecycle, updatedAt }] }`
  - Filter to only agents owned by `ctx.userId`
- [x] Create `api/routes/agents/agentsRoutes.ts`:
  - `GET /agents` → `agentsList`
  - Route prefix dispatcher returning `true/false`
- [x] Register `/agents` prefix in `routes.ts` dispatcher
- [x] Write tests for `agentsList` (returns agents, empty list, filters by user)
- [x] Run tests — must pass before next task

### Task 4: Agent history API

Add `GET /agents/:id/history` endpoint for loading an agent's message history.

- [x] Create `api/routes/agents/agentsHistory.ts`:
  - Input: `{ ctx, agentId (from URL), agentHistoryLoad callback, limit (from query) }`
  - Validates agentId is non-empty
  - Calls `agentHistoryLoad(ctx, agentId, limit)`
  - Returns `{ ok: true, history: AgentHistoryRecord[] }`
  - Supports `?limit=N` query parameter (default: no limit)
- [x] Add route `GET /agents/:id/history` in `agentsRoutes.ts`
  - Parse `:id` from pathname
  - Parse `?limit` from query string
- [x] Write tests for `agentsHistory` (returns history, with limit, empty history, missing agentId)
- [x] Run tests — must pass before next task

### Task 5: Send message to agent API

Add `POST /agents/:id/message` endpoint for sending a text message to an agent.

- [x] Create `api/routes/agents/agentsMessage.ts`:
  - Input: `{ ctx, agentId, text, agentPost callback }`
  - Validates agentId and text are non-empty strings
  - Constructs `AgentInboxItem` of type `"message"` with `{ text, files: [] }`
  - Calls `agentPost(ctx, { agentId }, item)`
  - Returns `{ ok: true }`
  - Returns `{ ok: false, error }` on validation failure
- [x] Add route `POST /agents/:id/message` in `agentsRoutes.ts`
  - Parse `:id` from pathname
  - Read JSON body with `readJsonBody`
- [x] Write tests for `agentsMessage` (valid message, missing text, missing agentId)
- [x] Run tests — must pass before next task

### Task 6: SSE event stream

Add `GET /events` endpoint that streams engine events to the app via Server-Sent Events.

- [x] Create `api/routes/events/eventsStream.ts`:
  - Input: `{ response: http.ServerResponse, eventBus: EngineEventBus }`
  - Sets headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - Applies CORS headers
  - Sends initial `{ type: "connected", timestamp }` event
  - Subscribes to `eventBus.onEvent()` and writes `data: JSON\n\n` for each event
  - Unsubscribes on `request.raw.on("close")`
  - Does NOT use `appSendJson` (streams directly to `response`)
- [x] Create `api/routes/events/eventsRoutes.ts`:
  - `GET /events` → `eventsStream`
- [x] Handle SSE route in `appServer.ts` `requestHandle()` AFTER auth but BEFORE `apiRouteHandle` dispatch (SSE needs direct response access, not the `sendJson` abstraction)
- [x] Register `/events` in the request handler
- [x] Write tests for `eventsStream` (headers set correctly, event format, cleanup on close)
- [x] Run tests — must pass before next task

### Task 7: Full tasks CRUD — create, read, update, delete

Extend the existing `/tasks` routes with full CRUD operations.

- [x] Create `api/routes/tasks/tasksCreate.ts`:
  - Input: `{ ctx, body: { title, code, description?, parameters? } }`
  - Validates required fields (title non-empty, code non-empty)
  - Delegates to `tasksCreate` callback
  - Returns `{ ok: true, task: { id, title, description, code, parameters, createdAt, updatedAt } }`
- [x] Create `api/routes/tasks/tasksRead.ts`:
  - Input: `{ ctx, taskId }`
  - Delegates to `tasksRead` callback
  - Returns full task record with triggers
  - Returns `{ ok: false, error: "Task not found." }` if missing
- [x] Create `api/routes/tasks/tasksUpdate.ts`:
  - Input: `{ ctx, taskId, body: { title?, code?, description?, parameters? } }`
  - Validates at least one field present
  - Delegates to `tasksUpdate` callback
  - Returns updated task
- [x] Create `api/routes/tasks/tasksDelete.ts`:
  - Input: `{ ctx, taskId }`
  - Delegates to `tasksDelete` callback
  - Returns `{ ok: true, deleted: true }`
- [x] Update `tasksRoutes.ts` to handle:
  - `POST /tasks/create` → `tasksCreate`
  - `GET /tasks/:id` → `tasksRead`
  - `POST /tasks/:id/update` → `tasksUpdate`
  - `POST /tasks/:id/delete` → `tasksDelete`
  - Keep existing `GET /tasks/active`
- [x] Write tests for each handler (success, validation errors, not found)
- [x] Run tests — must pass before next task

### Task 8: Task execution API

Add `POST /tasks/:id/run` endpoint for manually executing a task.

- [x] Create `api/routes/tasks/tasksRun.ts`:
  - Input: `{ ctx, taskId, body: { agentId?, parameters?, sync? } }`
  - Validates taskId non-empty
  - Delegates to `tasksRun` callback
  - If sync: returns `{ ok: true, output: string }`
  - If async: returns `{ ok: true, queued: true }`
  - Returns `{ ok: false, error }` on failure (task not found, parameter validation, etc.)
- [x] Add route `POST /tasks/:id/run` in `tasksRoutes.ts`
- [x] Write tests for `tasksRun` (sync success, async success, missing task, invalid params)
- [x] Run tests — must pass before next task

### Task 9: Task trigger management API

Add endpoints for adding/removing cron and webhook triggers on tasks.

- [x] Create `api/routes/tasks/tasksTriggerAdd.ts`:
  - Input: `{ ctx, taskId, body: { type: "cron" | "webhook", schedule?, timezone?, agentId?, parameters? } }`
  - Validates type field
  - For cron: validates schedule is present and valid
  - Delegates to `cronTriggerAdd` or `webhookTriggerAdd` callback
  - Returns `{ ok: true, trigger: { id, type, ... } }`
- [x] Create `api/routes/tasks/tasksTriggerRemove.ts`:
  - Input: `{ ctx, taskId, body: { type: "cron" | "webhook" } }`
  - Delegates to `cronTriggerRemove` or `webhookTriggerRemove` callback
  - Returns `{ ok: true, removed: number }`
- [x] Add routes in `tasksRoutes.ts`:
  - `POST /tasks/:id/triggers/add` → `tasksTriggerAdd`
  - `POST /tasks/:id/triggers/remove` → `tasksTriggerRemove`
- [x] Write tests for trigger add (cron valid, webhook valid, invalid type, missing schedule)
- [x] Write tests for trigger remove (success, no triggers to remove)
- [x] Run tests — must pass before next task

### Task 10: Skills listing and content API

Add `GET /skills` and `GET /skills/:id/content` endpoints.

- [x] Create `api/routes/skills/skillsList.ts`:
  - Input: `{ skills callback }`
  - Calls `skills.list()`
  - Returns `{ ok: true, skills: [{ id, name, description, sandbox, permissions, source, pluginId }] }`
  - Excludes `sourcePath` from response (internal filesystem detail)
- [x] Create `api/routes/skills/skillsContent.ts`:
  - Input: `{ skills callback, skillId }`
  - Calls `skills.list()`, finds skill by ID
  - Reads file content from `sourcePath` using `fs.readFile`
  - Returns `{ ok: true, skill: { id, name, description }, content: string }`
  - Returns `{ ok: false, error: "Skill not found." }` if missing
- [x] Create `api/routes/skills/skillsRoutes.ts`:
  - `GET /skills` → `skillsList`
  - `GET /skills/:id/content` → `skillsContent` (note: skill IDs contain colons like `user:my-skill`, so parse carefully from pathname)
- [x] Register `/skills` prefix in `routes.ts` dispatcher
- [x] Write tests for `skillsList` (returns list, empty list)
- [x] Write tests for `skillsContent` (found, not found, file read error)
- [x] Run tests — must pass before next task

### Task 11: Verify acceptance criteria

- [x] Verify all 5 new route groups are registered and dispatch correctly
- [x] Verify SSE stream connects and receives events
- [x] Verify all endpoints follow `{ ok: true/false }` response convention
- [x] Verify all endpoints are user-scoped via `ctx.userId`
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`) — all issues must be fixed
- [x] Run typecheck (`yarn typecheck`) — must pass

### Task 12: Update documentation

- [x] Create `doc/APP_API.md` documenting all app server endpoints:
  - Auth routes (existing)
  - Profile routes (new)
  - Agents routes (new)
  - Events/SSE route (new)
  - Tasks routes (existing + new)
  - Skills routes (new)
  - Documents routes (existing)
  - Costs routes (existing)
  - Prompts routes (existing)
- [x] Include request/response examples for each endpoint
- [x] Document SSE event format and connection lifecycle

## Technical Details

### Endpoint Summary

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `GET` | `/profile` | Read user profile | **new** |
| `POST` | `/profile/update` | Update user profile | **new** |
| `GET` | `/agents` | List user's agents | **new** |
| `GET` | `/agents/:id/history` | Agent message history | **new** |
| `POST` | `/agents/:id/message` | Send message to agent | **new** |
| `GET` | `/events` | SSE event stream | **new** |
| `GET` | `/tasks/active` | Active tasks with triggers | existing |
| `POST` | `/tasks/create` | Create task | **new** |
| `GET` | `/tasks/:id` | Read single task | **new** |
| `POST` | `/tasks/:id/update` | Update task | **new** |
| `POST` | `/tasks/:id/delete` | Delete task | **new** |
| `POST` | `/tasks/:id/run` | Execute task | **new** |
| `POST` | `/tasks/:id/triggers/add` | Add trigger | **new** |
| `POST` | `/tasks/:id/triggers/remove` | Remove triggers | **new** |
| `GET` | `/skills` | List all skills | **new** |
| `GET` | `/skills/:id/content` | Read skill content | **new** |

### Data Flow

```
App Client (React Native/Web)
    │
    ▼
AppServer.requestHandle()
    │
    ├── Auth routes (unauthenticated)
    │   └── /auth/validate, /auth/refresh, /auth/telegram
    │
    ├── appAuthExtract() → ctx = contextForUser({ userId })
    │
    ├── SSE route (direct response streaming)
    │   └── GET /events → eventBus.onEvent() → response.write()
    │
    └── apiRouteHandle() → domain dispatchers
        ├── /profile  → UsersRepository
        ├── /agents   → agentList callback, agentHistoryLoad, agentPost
        ├── /tasks    → TasksRepository, CronTasksRepository, WebhookTasksRepository, TaskExecutions
        ├── /skills   → Skills.list() + fs.readFile(sourcePath)
        ├── /documents → DocumentsRepository (existing)
        ├── /prompts  → filesystem (existing)
        └── /costs    → TokenStatsRepository (existing)
```

### SSE Event Format

```
data: {"type":"connected","timestamp":"2026-03-01T12:00:00.000Z"}\n\n
data: {"type":"agent.created","payload":{...},"timestamp":"..."}\n\n
data: {"type":"signal.generated","payload":{...},"timestamp":"..."}\n\n
```

Events are the same `EngineEvent` type used by the IPC server — `{ type, payload, timestamp }`.

### Profile Fields

```typescript
// GET /profile response
{
    ok: true,
    profile: {
        firstName: string | null,
        lastName: string | null,
        bio: string | null,
        about: string | null,
        country: string | null,
        timezone: string | null,
        systemPrompt: string | null,
        memory: boolean,
        nametag: string
    }
}

// POST /profile/update request body (all optional)
{
    firstName?: string | null,
    lastName?: string | null,
    bio?: string | null,
    about?: string | null,
    country?: string | null,
    timezone?: string | null,
    systemPrompt?: string | null,
    memory?: boolean
}
```

### Task CRUD Shapes

```typescript
// POST /tasks request body
{
    title: string,           // required
    code: string,            // required (Python)
    description?: string,
    parameters?: TaskParameter[]
}

// POST /tasks/:id/run request body
{
    agentId?: string,        // optional target agent override
    parameters?: Record<string, unknown>,  // runtime parameter values
    sync?: boolean           // default false; true = wait for result
}

// POST /tasks/:id/triggers request body
{
    type: "cron" | "webhook",
    schedule?: string,       // required for cron (5-field cron expression)
    timezone?: string,       // optional for cron (default: UTC)
    agentId?: string,        // optional target agent
    parameters?: Record<string, unknown>  // static params for cron
}
```

### Skill Response Shapes

```typescript
// GET /skills response
{
    ok: true,
    skills: [{
        id: string,          // e.g. "user:my-skill", "core:file-management"
        name: string,
        description: string | null,
        sandbox: boolean,
        permissions: string[],
        source: "core" | "config" | "plugin" | "user" | "agents",
        pluginId?: string
    }]
}

// GET /skills/:id/content response
{
    ok: true,
    skill: { id, name, description },
    content: string          // full markdown file content
}
```

## Post-Completion

**Manual verification:**
- Test SSE connection from browser/curl: `curl -N -H "Authorization: Bearer <token>" http://localhost:7332/events`
- Test profile read/update from app UI
- Test agent listing and history loading from app UI
- Test sending messages and seeing real-time SSE updates
- Test full task lifecycle: create → add trigger → run → read → delete

**App client updates (separate work):**
- Add fetch functions in `packages/daycare-app` for new endpoints
- Add Zustand stores for agents, skills, profile
- Add SSE client (EventSource) for real-time updates
- Update UI components to use new data
