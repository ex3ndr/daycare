# Exec Allowed Domains

The `exec` tool can optionally allow outbound network access for specific domains.
The list is explicit: exact domains are allowed, and subdomain wildcards like
`*.example.com` are supported. A global wildcard (`*`) disables domain
restrictions entirely, allowing all outbound network access. This is useful for
complicated applications with unusual networking behavior (for example untrusted
TLS or not respecting `HTTP_PROXY`). When
`allowedDomains` is omitted (or explicitly set to `[]`), Daycare resolves to an
empty allowlist and keeps network access blocked.

`exec` now runs with **zero additional permissions by default**:
- no network access
- no write grants
- read follows sandbox defaults (home and skills directories, plus system paths outside home; sensitive paths are always denied)

To allow network or filesystem writes, the call must include explicit `permissions`
tags (for example `@network`, `@write:/absolute/path`), and each tag is validated
as a subset of the caller's existing permissions.

`exec` also supports typed language ecosystem presets:
- `dart` -> `pub.dev`, `storage.googleapis.com`
- `dotnet` -> `nuget.org`, `api.nuget.org`, `globalcdn.nuget.org`
- `go` -> `proxy.golang.org`, `sum.golang.org`, `index.golang.org`, `golang.org`
- `java` -> `repo.maven.apache.org`, `repo1.maven.org`, `plugins.gradle.org`, `services.gradle.org`
- `node` -> `registry.npmjs.org`, `registry.yarnpkg.com`, `repo.yarnpkg.com`, `bun.sh` (covers npm/pnpm/yarn/bun)
- `php` -> `packagist.org`, `repo.packagist.org`
- `python` -> `pypi.org`, `files.pythonhosted.org`, `pypi.python.org`
- `ruby` -> `rubygems.org`
- `rust` -> `crates.io`, `index.crates.io`, `static.crates.io`

Presets are merged with explicit `allowedDomains`, deduped, then validated.
If network permission is enabled but the resolved allowlist is empty, execution is rejected.
Sandbox execution is routed through the Daycare `sandbox` wrapper with argument split
via `--` (`sandbox --settings <path> -- <command>`), avoiding command-option parsing
collisions in upstream CLI argument handling.

```mermaid
flowchart TD
  A[exec args] --> B[resolve allowedDomains]
  A --> C[expand packageManagers presets]
  B --> D[merge + dedupe]
  C --> D
  D --> E{contains "*"?}
  E -- yes --> I[build sandbox config with unrestricted network]
  E -- no --> J{resolved domains empty?<br/>(omitted or [])}
  J -- yes --> K[build sandbox config with empty allowlist (network blocked)]
  J -- no --> L[build sandbox config with resolved allowedDomains]
```
