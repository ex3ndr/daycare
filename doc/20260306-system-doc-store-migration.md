# System Prompt Document Store Migration

This change moves core prompt persistence from per-user filesystem files under `~/knowledge/` into versioned documents under `~/system/`.

## What Changed

- Engine startup now ensures `~/system` and its child documents: `soul`, `user`, `agents`, `tools`.
- System prompt rendering reads those documents from storage and falls back to bundled defaults when needed.
- User-home setup no longer creates `knowledge/` or filesystem `memory/` directories.
- Legacy prompt files are migrated into the owner user's `~/system/*` documents once.
- The `/prompts` API surface was removed because prompt editing now belongs to the document store.
- The app sidebar now lists all root documents, so `System`, `Memory`, `Documents`, and `People` are visible together.

## Startup Flow

```mermaid
flowchart TD
    A[Engine.start] --> B[userHomeEnsure]
    A --> C[memoryRootDocumentEnsure]
    A --> D[peopleRootDocumentEnsure]
    A --> E[documentRootDocumentEnsure]
    A --> F[documentSystemDocsEnsure]
    F --> G[~/system]
    G --> H[~/system/soul]
    G --> I[~/system/user]
    G --> J[~/system/agents]
    G --> K[~/system/tools]
```

## Legacy Migration

```mermaid
sequenceDiagram
    participant Engine
    participant Migrate as userHomeMigrate
    participant FS as Legacy Filesystem
    participant Docs as Document Store

    Engine->>Migrate: run once
    Migrate->>Docs: ensure ~/system tree
    Migrate->>FS: read owner home knowledge files
    alt owner files missing
        Migrate->>FS: read older dataDir prompt files
    end
    Migrate->>Docs: update ~/system/{soul,user,agents,tools}
    Migrate->>FS: write users/.migrated marker
```

## Sidebar Behavior

```mermaid
flowchart LR
    A[Loaded documents] --> B[parentId === null]
    B --> C[System]
    B --> D[Memory]
    B --> E[Documents]
    B --> F[People]
```
