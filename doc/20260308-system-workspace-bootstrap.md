# System Workspace Bootstrap

Daycare now bootstraps a reserved ownerless `##system##` workspace during engine startup.

- The workspace always uses the reserved user id `system`.
- The workspace is created only when the `##system##` nametag is missing.
- It is stored as a normal workspace user with `workspaceOwnerId = null`.
- It is created with the `❌` emoji.
- Its initial configuration enables `homeReady` and `appReady`.
- It does not set a custom workspace `systemPrompt`.
- The normal startup user bootstrap then creates its home and default documents.

```mermaid
flowchart TD
    A[Engine.start] --> B[workspaceSystemEnsure]
    B -->|system missing| C[Create workspace user id=system nametag=##system##]
    B -->|system exists| D[Validate id plus ownerless workspace]
    C --> E[users.findMany]
    D --> E
    E --> F[userHomeEnsure for each user]
    F --> G[userDocumentsEnsure for each user]
    G --> H[default workspace documents ensured]
```
