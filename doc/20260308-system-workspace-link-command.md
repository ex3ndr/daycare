# System Workspace Link Command

Daycare now exposes a CLI command for generating an app login link for the reserved `system` workspace.

- Command: `daycare system-link`
- It opens storage from the configured settings file.
- It ensures the reserved `system` workspace record exists.
- It resolves the workspace user id and delegates to the normal app-link signer.

```mermaid
flowchart TD
    A[daycare system-link] --> B[configLoad]
    B --> C[storageOpen]
    C --> D[workspaceSystemEnsure]
    D --> E[users.findByNametag system]
    E --> F[appLinkCommand workspace.id]
    F --> G[Signed app login URL]
```
