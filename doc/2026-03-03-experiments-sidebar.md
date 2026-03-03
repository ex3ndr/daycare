# Daycare App: Experiments Sidebar (JSON Render + PGlite)

## Summary
- Added a new `experiments` section in the app sidebar and mode routing.
- Introduced `ExperimentsView`, rendered via `@json-render/react-native`.
- Backed todo persistence with PGlite (`idb://daycare-experiments-v1`) on web runtime.
- Moved to a static JSON definition (`experimentsTodoDefinition`) that contains:
  - initial renderer state
  - a series of SQL query snapshots
  - SQL action templates rendered with Handlebars
  - the UI spec itself
- Wired action handlers to run templated SQL and refresh only declared query snapshots.

## Architecture
```mermaid
flowchart TD
    A[AppSidebar: experiments mode] --> B[SidebarModeView]
    B --> C[ExperimentsView]
    C --> D[JSONUIProvider + Renderer]
    D --> E[JSON Spec: experimentsTodoDefinition.spec]
    D --> F[StateStore]
    C --> G[experimentsTodoInitialize]
    G --> H[bootstrapSql]
    H --> I[PGlite Adapter]
    I --> J[(experiments_todos table)]
    G --> K[queriesRefresh]
    K --> F
    E --> L[Action Bindings]
    L --> M[experimentsTodoHandlersBuild]
    M --> N[Handlebars SQL render]
    N --> I
    M --> K
```

## PGlite Schema
```sql
CREATE TABLE IF NOT EXISTS experiments_todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_experiments_todos_created_at
    ON experiments_todos (created_at DESC);
```

## Web Runtime Note
The web adapter now loads `pglite.data` and `pglite.wasm` explicitly from a pinned CDN URL and passes them to PGlite as `fsBundle` and `wasmModule`. This avoids Metro resolving assets relative to the dev bundle URL, which caused an FS bundle size mismatch at runtime.

```mermaid
sequenceDiagram
    participant View as ExperimentsView
    participant DB as experimentsTodoDb.web
    participant CDN as jsdelivr
    participant PG as PGlite

    View->>DB: experimentsTodoDbCreate()
    DB->>CDN: fetch pglite.data
    DB->>CDN: fetch pglite.wasm
    DB->>PG: new PGlite(idb://..., { fsBundle, wasmModule })
    PG-->>DB: waitReady resolved
```

## SQL-Templated Actions
Every UI action compiles a SQL template via Handlebars (`{{sql ...}}`) with context:
- `state`: full renderer snapshot
- `params`: resolved action params from JSON-render bindings
- `runtime`: generated values (`generatedId`, `now`)

```mermaid
sequenceDiagram
    participant UI as JSON Button Action
    participant Handler as experimentsTodoHandlersBuild
    participant HB as experimentsSqlTemplateRender
    participant DB as PGlite
    participant Store as StateStore

    UI->>Handler: action + params
    Handler->>HB: render SQL(state, params, runtime)
    HB-->>Handler: SQL string
    Handler->>DB: exec(sql)
    Handler->>DB: query refresh SQLs
    DB-->>Handler: rows
    Handler->>Store: pointer updates (/todos, /stats/*)
```

## Loading Behavior
`/loading` is now reserved for the first bootstrap only (`experimentsTodoInitialize`). Action handlers no longer toggle loading, so create/toggle/delete runs without showing the loading card.

```mermaid
stateDiagram-v2
    [*] --> Bootstrapping
    Bootstrapping: /loading=true
    Bootstrapping --> Ready: bootstrap + first query refresh
    Ready: /loading=false
    Ready --> Ready: todoCreate/todoToggle/todoDelete
```

## Row Action Params
Row buttons now pass `index` (`$index`) and handlers resolve `todoId` from `/todos/<index>/id` before SQL templating. This avoids silent no-op updates when non-scalar params are provided.

```mermaid
sequenceDiagram
    participant UI as Row Button
    participant Handler as runAction
    participant Store as StateStore
    participant SQL as SQL Template

    UI->>Handler: params { index }
    Handler->>Store: get /todos/{index}/id
    Store-->>Handler: todoId
    Handler->>SQL: render with scalar todoId
```
