# Hierarchical Todos

## Overview
Add a workspace-scoped hierarchical todo system to the monolith. Each todo has a title, markdown description, and status. Todos can have unlimited nested children. Sibling ordering uses fractional indexing (same approach as happy-list). Exposed via REST API and LLM tools.

- **Statuses**: `draft`, `unstarted`, `started`, `finished`, `abandoned`
- **No deletion** — todos are archived by setting status to `abandoned` (cascades to children)
- **Workspace-scoped** — todos belong to a workspace, visible to all workspace members
- **Ordering** — fractional indexing (`generateKeyBetween`) for sibling order within same parent

## Context
- Storage: PGlite/Postgres via Drizzle ORM, versioned rows pattern
- API: `POST /<domain>/action` convention, `{ ok: true/false }` responses
- Tools: registered in `engine.ts` via `this.modules.tools.register("core", ...)`
- Ordering reference: `~/Developer/happy-list-server/sources/utils/fractionalIndex.ts`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add fractional indexing utility
- [x] Copy `fractionalIndex.ts` from `~/Developer/happy-list-server/sources/utils/` to `packages/daycare/sources/utils/fractionalIndex.ts`
- [x] Adapt to project conventions (Biome style, ESM imports)
- [x] Write tests for `generateKeyBetween` (null/null, between two keys, edge cases)
- [x] Write tests for `generateNKeysBetween`
- [x] Run tests — must pass before next task

### Task 2: Define database schema and migration
- [x] Add `TodoDbRecord` types to `packages/daycare/sources/storage/databaseTypes.ts`:
  - `id: string`, `workspaceId: string`, `parentId: string | null`, `title: string`, `description: string`, `status: string` (draft/unstarted/started/finished/abandoned), `rank: string` (fractional index among siblings), `createdAt: number`, `updatedAt: number`, plus versioning fields (`version`, `validFrom`, `validTo`)
- [x] Add Drizzle table definition to `packages/daycare/sources/schema.ts` with indexes on `(workspaceId, parentId, rank)` and `(workspaceId, validTo)`
- [x] Create migration SQL file `packages/daycare/sources/storage/migrations/20260308120000_todos.sql`
- [x] Register migration in `_migrations.ts`
- [x] Run tests — must pass before next task

### Task 3: Implement TodosRepository
- [x] Create `packages/daycare/sources/storage/todosRepository.ts` with:
  - `create(workspaceId, input)` — insert with rank
  - `findById(workspaceId, id)` — single todo lookup
  - `findByParent(workspaceId, parentId)` — list children sorted by rank
  - `findRoots(workspaceId)` — list root todos sorted by rank
  - `findTree(workspaceId, rootId?, depth?)` — fetch flat list of todos in subtree (default depth=2), returns `TodoDbRecord[]` with parentId for client-side tree assembly
  - `update(workspaceId, id, input)` — update title/description/status
  - `reorder(workspaceId, id, parentId, index)` — move todo to new position (recompute rank)
  - `archive(workspaceId, id)` — set status to abandoned, cascade to children
  - `batchUpdateStatus(workspaceId, ids, status)` — bulk status change
- [x] Add `TodosRepository` to `Storage` facade in `storage.ts`
- [x] Write tests for create, findById, findByParent, findRoots
- [x] Write tests for findTree with depth limit
- [x] Write tests for update, reorder (move within siblings, move to different parent)
- [x] Write tests for archive cascade and batchUpdateStatus
- [x] Run tests — must pass before next task

### Task 3.5: Add ASCII tree formatter
- [x] Create `packages/daycare/sources/utils/todoTreeFormat.ts` — converts flat todo list into ASCII tree string for LLM consumption
- [ ] Format: indented tree with status icons, e.g.:
  ```
  ○ Build MVP [unstarted] (id: abc123)
    ● Design database schema [started] (id: def456)
      ✓ Choose ORM [finished] (id: ghi789)
      ○ Write migrations [unstarted] (id: jkl012)
    ○ Implement API [unstarted] (id: mno345)
  ```
- [x] Status icons: `◻` draft, `○` unstarted, `●` started, `✓` finished, `✗` abandoned
- [x] Include todo id in output so LLM can reference specific todos
- [x] Write tests for tree formatting (empty, single, nested, multi-root)
- [x] Run tests — must pass before next task

➕ Implementation note: workspace scoping is derived from authenticated `ctx.userId` because the app server resolves `/w/{workspaceId}` before route dispatch. `workspaceId` request/query fields will be treated as optional compatibility checks instead of the primary source of scope.
➕ Implementation note: utility files live under the existing `packages/daycare/sources/utils/` directory, not `sources/util/`, to match the current package layout.
➕ Implementation note: migrations follow the existing timestamped naming scheme, so the todos migration is `20260308120000_todos.sql`.

### Task 4: Add API routes
- [x] Create `packages/daycare/sources/api/routes/todos/todosRoutes.ts` — route dispatcher
- [x] Create `todosCreate.ts` — `POST /todos/create` (title, description, status, parentId, workspaceId)
- [x] Create `todosUpdate.ts` — `POST /todos/:id/update` (title, description, status)
- [x] Create `todosReorder.ts` — `POST /todos/:id/reorder` (parentId, index)
- [x] Create `todosArchive.ts` — `POST /todos/:id/archive` (cascade to children)
- [x] Create `todosList.ts` — `GET /todos?workspaceId=&parentId=` (list children or roots)
- [x] Create `todosTree.ts` — `GET /todos/tree?workspaceId=&rootId=` (full subtree)
- [x] Create `todosBatchStatus.ts` — `POST /todos/batch-status` (ids[], status)
- [x] Register in `routes.ts` dispatcher
- [x] Run tests — must pass before next task

### Task 5: Add LLM tools
- [x] Create `packages/daycare/sources/engine/modules/tools/todoListToolBuild.ts` — list todos as ASCII tree (default depth=2, or subtree by id); `toLLMText` returns the ASCII-formatted tree
- [x] Create `todoCreateToolBuild.ts` — create todo with optional parentId
- [x] Create `todoUpdateToolBuild.ts` — update title/description/status
- [x] Create `todoReorderToolBuild.ts` — reorder within parent
- [x] Create `todoArchiveToolBuild.ts` — archive todo and children
- [x] Create `todoBatchStatusToolBuild.ts` — bulk status change
- [x] Register all tools in `engine.ts`
- [x] Write tests for tool definitions (schema validation, toLLMText output)
- [x] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [x] Verify hierarchical nesting works at 3+ levels
- [x] Verify fractional indexing maintains order after multiple reorders
- [x] Verify archive cascades to all descendants
- [x] Verify workspace scoping isolates todos between workspaces
- [x] Run full test suite
- [x] Run linter — all issues must be fixed

### Task 7: Update documentation
- [x] Add todos section to `doc/APP_API.md`
- [x] Document LLM tools in relevant docs

## Technical Details

### Database Table: `todos`
| Column | Type | Notes |
|--------|------|-------|
| id | text | PK (with version) |
| workspace_id | text | NOT NULL |
| parent_id | text | NULL for root todos |
| title | text | NOT NULL |
| description | text | NOT NULL, default "" |
| status | text | NOT NULL, one of: draft/unstarted/started/finished/abandoned |
| rank | text | NOT NULL, fractional index for sibling order |
| version | integer | NOT NULL, default 1 |
| valid_from | bigint | NOT NULL |
| valid_to | bigint | NULL for current version |
| created_at | bigint | NOT NULL |
| updated_at | bigint | NOT NULL |

### Tree Return Format
- **API** (`GET /todos/tree`): returns `{ ok: true, todos: TodoRecord[] }` — flat array with `parentId` for client-side tree assembly, default depth=2
- **LLM tools** (`todo_list`): returns ASCII tree via `toLLMText`, e.g.:
  ```
  ○ Build MVP [unstarted] (id: abc123)
    ● Design database schema [started] (id: def456)
      ✓ Choose ORM [finished] (id: ghi789)
      ○ Write migrations [unstarted] (id: jkl012)
    ○ Implement API [unstarted] (id: mno345)
  ```
- Icons: `◻` draft, `○` unstarted, `●` started, `✓` finished, `✗` abandoned
- Depth parameter controls how many levels deep to fetch (default 2, or unlimited for subtree by id)

### Reorder Algorithm
1. Fetch siblings at target parentId, ordered by rank
2. Remove the moving todo from the list
3. Calculate new rank: `generateKeyBetween(prevSibling?.rank ?? null, nextSibling?.rank ?? null)`
4. Update the todo's rank (and parentId if moving to different parent)

### Archive Cascade
1. Find all descendants recursively (CTE query)
2. Set status to `abandoned` on all of them
3. Execute in a single transaction

## Post-Completion

**Manual verification:**
- Test via app API with real workspace
- Verify LLM tools work in agent conversations
