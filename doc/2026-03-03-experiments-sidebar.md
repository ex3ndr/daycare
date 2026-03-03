# Daycare App: Experiments Sidebar (JSON Render + PGlite)

## Summary
- Added a new `experiments` section in the app sidebar and mode routing.
- Introduced `ExperimentsView`, rendered via `@json-render/react-native`.
- Backed todo persistence with PGlite (`idb://daycare-experiments-v1`) on web runtime.
- Wired JSON actions (`todoCreate`, `todoToggle`, `todoDelete`) to PGlite mutations and state refresh.

## Architecture
```mermaid
flowchart TD
    A[AppSidebar: experiments mode] --> B[SidebarModeView]
    B --> C[ExperimentsView]
    C --> D[JSONUIProvider + Renderer]
    D --> E[JSON Spec: experimentsTodoSpecBuild]
    D --> F[StateStore]
    E --> G[Action Bindings]
    G --> H[experimentsTodoHandlersBuild]
    H --> I[PGlite Adapter]
    I --> J[(experiments_todos table)]
    I --> K[List rows]
    K --> L[experimentsTodoStateBuild]
    L --> F
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
