# System Prompt Vault Migration

Historical note: the one-time startup migration described below was removed on 2026-03-08 after rollout completed.

This change moves core prompt persistence from per-user filesystem files under `~/knowledge/` into versioned vault entries under `vault://system/`.

## What Changed

- Engine startup now ensures `vault://system` and its child entries: `soul`, `user`, `agents`, `tools`.
- System prompt rendering reads those entries from storage and falls back to bundled defaults when needed.
- User-home setup no longer creates `knowledge/` or filesystem `memory/` directories.
- Legacy prompt files are migrated into the owner user's `vault://system/*` entries once.
- The `/prompts` API surface was removed because prompt editing now belongs to the vault.
- The app sidebar now lists all root vault entries, so `System`, `Memory`, `Vault`, and `People` are visible together.

## Startup Flow

```mermaid
flowchart TD
    A[Engine.start] --> B[userHomeEnsure]
    A --> C[memoryRootVaultEnsure]
    A --> D[peopleRootVaultEnsure]
    A --> E[vaultRootVaultEnsure]
    A --> F[vaultSystemDocsEnsure]
    F --> G[vault://system]
    G --> H[vault://system/soul]
    G --> I[vault://system/user]
    G --> J[vault://system/agents]
    G --> K[vault://system/tools]
```

## Legacy Migration

```mermaid
sequenceDiagram
    participant Engine
    participant Migrate as Historical startup migration
    participant FS as Legacy Filesystem
    participant Docs as Vault

    Engine->>Migrate: run once
    Migrate->>Docs: ensure vault://system tree
    Migrate->>FS: read owner home knowledge files
    alt owner files missing
        Migrate->>FS: read older dataDir prompt files
    end
    Migrate->>Docs: update vault://system/{soul,user,agents,tools}
    Migrate->>FS: write users/.migrated marker
```

## Sidebar Behavior

```mermaid
flowchart LR
    A[Loaded vault entries] --> B[parentId === null]
    B --> C[System]
    B --> D[Memory]
    B --> E[Vault]
    B --> F[People]
```
