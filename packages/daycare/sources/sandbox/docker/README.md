# Sandbox Docker Runtime

The sandbox Docker runtime adds a container layer around `sandbox-runtime` (`srt`) command execution.

## What Runs Where

- `Sandbox.read()` and `Sandbox.write()` run on the host filesystem.
- `Sandbox.exec()` runs in a long-lived Docker container when Docker is enabled.
- The host user home (`<usersDir>/<userId>/home`) is bind-mounted to `/home` in the container.
- The host active skills root (`<usersDir>/<userId>/skills/active`) is bind-mounted read-only to `/shared/skills`.

## Settings

Configure Docker runtime in `settings.json`:

```json
{
    "docker": {
        "enabled": true,
        "image": "daycare-sandbox",
        "tag": "latest",
        "socketPath": "/var/run/docker.sock",
        "runtime": "runsc",
        "enableWeakerNestedSandbox": false,
        "readOnly": false,
        "unconfinedSecurity": false,
        "capAdd": ["NET_ADMIN"],
        "capDrop": ["MKNOD"],
        "allowLocalNetworkingForUsers": ["user-admin"]
    }
}
```

Defaults when omitted:

- `enabled`: `false`
- `image`: `daycare-sandbox`
- `tag`: `latest`
- `socketPath`: `undefined` (Docker default)
- `runtime`: `undefined` (Docker default)
- `enableWeakerNestedSandbox`: `false`
- `readOnly`: `false`
- `unconfinedSecurity`: `false`
- `capAdd`: `[]`
- `capDrop`: `[]`
- `allowLocalNetworkingForUsers`: `[]`

When `unconfinedSecurity` is `true`, sandbox containers are created with:

- `SecurityOpt: ["seccomp=unconfined", "apparmor=unconfined"]`

When `capAdd`/`capDrop` are set, sandbox containers are created with matching Docker capability options:

- `HostConfig.CapAdd`
- `HostConfig.CapDrop`

When `readOnly` is `true`, sandbox containers are created with:

- `HostConfig.ReadonlyRootfs: true`

The `/home` bind mount remains writable, so only mounted home content is writable while the rest of the root filesystem
is read-only.

When `enableWeakerNestedSandbox` is `true`, `Sandbox.exec()` includes this runtime config:

- `enableWeakerNestedSandbox: true`

## Execution Flow

```mermaid
graph TD
    A[Sandbox.exec] --> B{docker.enabled}
    B -->|false| C[runInSandbox on host]
    B -->|true| D[dockerRunInSandbox]
    D --> E[DockerContainers.ensure]
    E --> E1[dockerNetworksEnsure]
    E1 --> E2{userId in docker.allowLocalNetworkingForUsers}
    E2 -->|yes| E3[network daycare-local]
    E2 -->|no| E4[network daycare-isolated]
    E3 --> F[docker exec /usr/local/bin/srt]
    E4 --> F
    F --> G[srt policy inside container]
```

## Docker Network Isolation

- Every Docker sandbox user is isolated by default on `daycare-isolated`.
- Users listed in `docker.allowLocalNetworkingForUsers` are placed on `daycare-local`.
- If an existing container is attached to the wrong network (for example after settings changes), it is stopped, removed, and recreated on the expected network.

## Image Version Guard

Each sandbox container is stamped at creation time with:

- `daycare.image.version` from `DOCKER_IMAGE_VERSION` in `dockerImageVersion.ts`
- `daycare.image.id` from `docker image inspect` (`dockerImageIdResolve`)
- `daycare.security.profile` from `docker.unconfinedSecurity`
- `daycare.capabilities` from `docker.capAdd`/`docker.capDrop`
- `daycare.readonly` from `docker.readOnly`

`dockerContainerEnsure` compares these labels against current values. If any label is missing or mismatched, the
container is treated as stale, then stopped and removed; recreation with fresh labels is deferred to the same ensure
flow.

At engine startup, when Docker is enabled, Daycare scans all `daycare-sandbox-*` containers and proactively removes
stale ones before normal startup continues.

```mermaid
flowchart TD
    A[Engine.start] --> B{docker.enabled}
    B -- no --> Z[skip]
    B -- yes --> C[resolve current image id]
    C --> D[list daycare-sandbox-* containers]
    D --> E{for each container\nlabels match?}
    E -- yes --> F[keep container]
    E -- no --> G[stop + remove container]
    F --> H[done]
    G --> H
```

### Bumping `DOCKER_IMAGE_VERSION`

Bump `DOCKER_IMAGE_VERSION` manually when sandbox image behavior changes in an incompatible way:

1. Update `DOCKER_IMAGE_VERSION` in `dockerImageVersion.ts` (e.g. `"1"` -> `"2"`).
2. Deploy/restart engine.
3. Startup removes stale containers, and ensure recreates containers lazily when execution needs them.

## Path Translation

- Host to container: `sandboxPathHostToContainer()`
- Container to host: `sandboxPathContainerToHost()`

Examples:

- Host: `/data/users/u123/home/desktop/project`
- Container: `/home/desktop/project`
- Host: `/data/users/u123/skills/active/core--scheduling`
- Container: `/shared/skills/core--scheduling`

The runtime rewrites:

- srt filesystem policy paths (`allowWrite`, `denyRead`, `denyWrite`)
- `cwd`
- HOME-related environment variables
