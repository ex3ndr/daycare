# Docker Image Version Guard

Daycare now detects stale sandbox containers using two metadata labels written at container creation:

- `daycare.image.version` from `DOCKER_IMAGE_VERSION`
- `daycare.image.id` from Docker image inspect (`Id`)

Containers are stale when labels are missing or values mismatch current runtime values.

## Ensure Path

```mermaid
flowchart TD
    A[dockerContainerEnsure] --> B[resolve current image id]
    B --> C{container exists?}
    C -- no --> D[create container + stamp labels]
    C -- yes --> E{labels match version + image id?}
    E -- yes --> F[start if needed + reuse]
    E -- no --> G[stop + remove stale container]
    G --> D
```

## Startup Scan

```mermaid
flowchart TD
    A[Engine.start] --> B{docker.enabled}
    B -- no --> Z[skip]
    B -- yes --> C[dockerContainersStaleRemove]
    C --> D[resolve current image id]
    D --> E[list daycare-sandbox-*]
    E --> F{labels match?}
    F -- yes --> G[keep container]
    F -- no --> H[stop + remove stale]
```

## Operational Note

When the sandbox image behavior changes, bump `DOCKER_IMAGE_VERSION` in
`packages/daycare/sources/sandbox/docker/dockerImageVersion.ts` to force container replacement.
