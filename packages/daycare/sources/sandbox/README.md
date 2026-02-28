# Sandbox

The `Sandbox` class is the unified I/O layer for agent-scoped filesystem and command execution.

## Purpose

`Sandbox` centralizes:
- secure file reads (`read`)
- secure file writes (`write`)
- sandboxed command execution (`exec`)

This keeps tool modules focused on UX/schema formatting while enforcing one consistent security boundary.

## Construction

```ts
import { Sandbox } from "@/types";

const sandbox = new Sandbox({
    homeDir: userHome.home,
    permissions: state.permissions,
    mounts: [
        { hostPath: userHome.skillsActive, mappedPath: "/shared/skills" },
        { hostPath: examplesDir, mappedPath: "/shared/examples" }
    ],
    docker: {
        enabled: true,
        image: "daycare-sandbox",
        tag: "latest",
        socketPath: "/var/run/docker.sock",
        runtime: "runsc",
        enableWeakerNestedSandbox: false,
        readOnly: false,
        unconfinedSecurity: false,
        capAdd: [],
        capDrop: [],
        allowLocalNetworkingForUsers: [],
        userId: ctx.userId
    }
});
```

Inputs:
- `homeDir`: sandbox HOME and default write root
- `workingDir`: derived from `permissions.workingDir` and cannot be overridden at construction
- `permissions`: session permissions used by read/write checks
- `mounts` (optional): extra mount points for virtual paths (e.g. `/shared/skills`). Home is always mounted at `/home` automatically.
- `docker` (optional): enable Docker-wrapped `exec` with per-user container config

## API

### `read(args)`

```ts
await sandbox.read({ path, offset, limit });
```

Behavior:
- resolves relative paths from `workingDir`
- enforces `sandboxCanRead`
- blocks direct symlink reads
- detects supported image formats and returns `type: "image"`
- supports raw binary mode (`binary: true`) and raw text mode (`raw: true`)

### `write(args)`

```ts
await sandbox.write({ path, content, append });
```

Behavior:
- requires absolute path
- enforces `sandboxCanWrite`
- blocks direct symlink writes
- creates parent directories
- writes string or binary content via file handle
- returns both host `resolvedPath` and agent-facing `sandboxPath` (`~/...` when inside `homeDir`)

### `exec(args)`

```ts
await sandbox.exec({ command, cwd, timeoutMs, env, dotenv, packageManagers, allowedDomains });
```

Behavior:
- validates allowed domains
- resolves `cwd` inside workspace scope
- optionally loads dotenv values (`dotenv: true` uses `cwd/.env`, string uses explicit path)
- merges env in order: `process.env` -> dotenv -> explicit `env`
- builds filesystem policy from permissions
- always runs with `HOME = homeDir`
- executes through `runInSandbox` (host mode) or `dockerRunInSandbox` (docker mode)

## Docker Settings

Enable Docker runtime in `settings.json`:

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
        "allowLocalNetworkingForUsers": ["user-admin"],
        "isolatedDnsServers": ["1.1.1.1", "8.8.8.8"],
        "localDnsServers": ["192.168.0.1"]
    }
}
```

Path mapping uses the generic mount list. Home is always `/home`, extra mounts use their `mappedPath`:
- host: `/data/users/<userId>/home/...` → container: `/home/...`
- host: `/data/users/<userId>/skills/active/...` → container: `/shared/skills/...`

## Tool Context

`ToolExecutionContext` now exposes `sandbox` as the primary I/O dependency.

```ts
const text = await context.sandbox.read({ path: "notes.txt" });
await context.sandbox.write({ path: "/tmp/out.txt", content: "ok" });
const result = await context.sandbox.exec({ command: "ls", allowedDomains: ["example.com"] });
```
