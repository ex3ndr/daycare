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

