# Remove User Home Migration

The legacy `userHomeMigrate` startup step has been removed. All environments have already been migrated, so engine startup now only ensures user homes and document roots.

## What Changed

- Removed `userHomeMigrate` from engine startup.
- Deleted the obsolete migration source and its tests.
- Kept normal startup setup: `userHomeEnsure` and `userDocumentsEnsure`.

## Startup Flow

```mermaid
flowchart TD
    A[Engine.start] --> B[storage migrations ready]
    B --> C[ownerCtxEnsure]
    C --> D[load all users]
    D --> E[userHomeEnsure per user]
    E --> F[userDocumentsEnsure per user]
    F --> G[continue runtime startup]
```
