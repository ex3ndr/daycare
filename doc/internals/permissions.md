# Permissions

The runtime now uses a fixed sandbox model. Dynamic permission expansion is removed.

## Core model

`SessionPermissions` is now:

```ts
export type SessionPermissions = {
    workingDir: string;
    writeDirs: string[];
};
```

- `workingDir`: path base for relative tool operations.
- `writeDirs`: explicit writable roots.
- Reads are globally allowed except sandbox deny-lists.

```mermaid
flowchart TD
  A[SessionPermissions] --> B[workingDir]
  A --> C[writeDirs]
  B --> D[Path resolution]
  C --> E[Write allowlist]
  D --> F[Sandbox execution]
  E --> F
```

## Agent defaults

- User agents: `permissionBuildUser(userHome)` => `workingDir=userHome.desktop`, `writeDirs=[userHome.home]`.
- Swarm agents: same baseline as user-scoped agents, plus owner-mounted swarm shares when applicable.

```mermaid
flowchart LR
  U[UserHome] --> UP[User permissions]
  S[Swarm home share] --> SP[Swarm-visible mounts]
  UP --> R[Runtime sandbox]
  SP --> R
```

## Removed system

The following runtime capabilities were removed:

- `request_permission` tool
- `grant_permission` tool
- `PermissionRequestRegistry`
- connector permission callbacks (`onPermission`, `requestPermission`)
- permission tags (`@network`, `@events`, `@read:*`, `@write:*`, `@workspace`) as runtime expansion inputs

```mermaid
flowchart TD
  Old[Dynamic permission flow] --> X[Removed]
  X --> Fixed[Static per-agent permissions + OS sandbox]
```

## Network and events

- Network is always available in sandboxed exec/process tools, but `allowedDomains` is mandatory and must be explicit.
- Wildcard `"*"` is rejected.
- Engine socket/event permission forwarding is removed.

## Path security utilities

Path hardening remains active under `sources/sandbox/`:

- `pathSanitize`
- `pathResolveSecure`
- `openSecure`

These continue to protect against traversal/symlink escape and TOCTOU-style races.
