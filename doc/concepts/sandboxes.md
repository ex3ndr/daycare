# Sandboxes

Daycare sandboxes shell commands and file operations to prevent unauthorized access to the host system. The sandbox system controls filesystem reads/writes and network access.

## Default sandbox policy

By default, `exec` and `process_start` run with **zero additional permissions**:

- No network access
- No write grants
- Reads follow sandbox defaults (all paths except the deny-list)

To allow network or writes, the call must include explicit `permissions` tags, each validated against the caller agent's existing permissions.

## Filesystem deny-list

A default set of sensitive paths is blocked for both reads and writes:

| Category | Paths |
|----------|-------|
| Home secrets | `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.kube`, `~/.docker`, `~/.netrc` |
| System secrets | `/etc/ssh`, `/etc/sudoers`, `/etc/shadow`, `/etc/ssl/private` |
| macOS keychains | `~/Library/Keychains`, `~/Library/Application Support/com.apple.TCC` |

## Path security

### Path sanitization

All paths are validated before use:
- Null bytes (`\x00`) are rejected (prevents C library string truncation)
- Control characters (ASCII 0-31 except tab/newline) are rejected
- Paths over 4096 characters are rejected

### Symlink containment

`pathResolveSecure` prevents symlink escape attacks by:
1. Resolving all symlinks via `fs.realpath()`
2. Checking containment against real paths of allowed directories

### TOCTOU protection

`openSecure` opens file handles atomically with `lstat` verification to prevent time-of-check to time-of-use race conditions.

### App directory isolation

- Non-app agents are denied read/write access to `<workspace>/apps/*`.
- App agents can access only their own app directory and can write only to `<workspace>/apps/<app-id>/data`.

## Allowed domains

The `exec` tool supports an explicit domain allowlist for outbound network access:

- Exact domains and `*.example.com` wildcards are supported
- Omitting `allowedDomains` keeps network access blocked
- Providing `allowedDomains: []` is valid and also keeps network access blocked
- Global wildcard (`*`) disables domain restrictions entirely
- Network access requires the `@network` permission tag

### Language ecosystem presets

Use `packageManagers` to auto-allow common package registry hosts:

| Preset | Allowed domains |
|--------|----------------|
| `node` | `registry.npmjs.org`, `registry.yarnpkg.com`, `repo.yarnpkg.com`, `bun.sh` |
| `python` | `pypi.org`, `files.pythonhosted.org`, `pypi.python.org` |
| `rust` | `crates.io`, `index.crates.io`, `static.crates.io` |
| `go` | `proxy.golang.org`, `sum.golang.org`, `index.golang.org`, `golang.org` |
| `java` | `repo.maven.apache.org`, `repo1.maven.org`, `plugins.gradle.org`, `services.gradle.org` |
| `ruby` | `rubygems.org` |
| `php` | `packagist.org`, `repo.packagist.org` |
| `dotnet` | `nuget.org`, `api.nuget.org`, `globalcdn.nuget.org` |
| `dart` | `pub.dev`, `storage.googleapis.com` |

## Home remapping

The `home` option remaps HOME-related environment variables for commands. This prevents package managers and CLI tools from reading/writing the real user home.

Affected variables: `HOME`, `USERPROFILE`, `XDG_*`, `TMP*`, and language-specific cache paths.

## Durable processes

Durable processes are long-running managed processes with persistence and auto-restart capabilities.

### Storage

Each process stores state under `<engine-data>/processes/<id>/`:

| File | Purpose |
|------|---------|
| `record.json` | Pid, desired state, restart policy, backoff state |
| `sandbox.json` | Sandbox runtime config |
| `process.log` | Combined stdout/stderr stream |

### Lifecycle

- Processes spawn detached and survive engine restarts
- On engine startup, records are rehydrated and running pids are adopted
- Stale pids are cleared when host boot time differs from the recorded boot time
- Keep-alive restarts use exponential backoff (2s base, 60s max)
- Stop operations terminate the full process group

### Tools

| Tool | Description |
|------|-------------|
| `process_start` | Start a sandboxed detached process |
| `process_list` | List process status and metadata |
| `process_get` | Get one process record by id |
| `process_stop` | Stop one managed process |
| `process_stop_all` | Stop all managed processes |
