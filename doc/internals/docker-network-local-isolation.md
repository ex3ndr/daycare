# Docker Local-Network Isolation

## Summary

Docker sandbox containers now default to an isolated network profile so local-network access is denied by default.

An exception list in `settings.json` allows local networking for specific users:

```json
{
    "docker": {
        "enabled": true,
        "allowLocalNetworkingForUsers": ["user-admin", "user-dev"]
    }
}
```

## Behavior

- Default users run on `daycare-isolated`.
- Users in `docker.allowLocalNetworkingForUsers` run on `daycare-local`.
- Daycare ensures both networks exist before executing container commands.
- `daycare-isolated` containers pin DNS to public resolvers (`1.1.1.1`, `8.8.8.8`) so they do not depend on local DNS infrastructure.
- `daycare-local` containers keep Docker default DNS so local-network service discovery remains available.
- If a user's existing container is on the wrong network, Daycare recreates it on the correct one.

## Network Selection Flow

```mermaid
flowchart TD
    A[Sandbox.exec docker mode] --> B[DockerContainers.exec]
    B --> C[Ensure daycare-isolated and daycare-local networks]
    C --> D{userId in allowLocalNetworkingForUsers?}
    D -- no --> E[Pick daycare-isolated + public DNS]
    D -- yes --> F[Pick daycare-local + default DNS]
    E --> G[dockerContainerEnsure]
    F --> G
    G --> H{container on expected network?}
    H -- yes --> I[Reuse container]
    H -- no --> J[Stop and remove]
    J --> K[Create on expected network]
    I --> L[docker exec srt]
    K --> L
```
