# Multiuser Filesystem Isolation

This change removes global workspace/filesystem fallbacks and makes user-scoped paths the default runtime model.

## Architecture

```mermaid
flowchart TD
    A[Agent Target] --> B[Resolve userId]
    B --> C[UserHome users/<userId>/home]
    C --> D[permissionBuildUser]
    C --> E[FileFolder users/<userId>/home/downloads]
    E --> F[Connector received files]
    E --> G[Generated images]

    H[Engine startup] --> I[ownerUserIdEnsure]
    I --> J[userHomeEnsure(owner)]
    J --> K[Cron/Heartbeat resolveDefaultPermissions]

    L[Apps] --> M[users/<userId>/apps only]
    N[Skills] --> O[user root only]

    P[Legacy migration] --> Q[legacy workspace from raw settings]
    Q --> R[userHomeMigrate legacy files/apps]
```

## Key Outcomes

- `Config.workspaceDir`, `Config.filesDir`, and `Config.defaultPermissions` are removed.
- All agents require `userId` and `UserHome`; no global permission fallback remains.
- `FileFolder` is path-only and metadata sidecars were removed.
- Received files and generated images are saved under `UserHome.downloads`.
- Global memory plugin and global apps/skills discovery fallbacks were removed.
