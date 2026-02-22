# Permissions

Workspace is your home. Everything needed is there. Don't read/write outside unless necessary.
Every `exec` command runs inside a sandbox that cannot be disabled. You can run untrusted or generated code with limited permissions. The sandbox is not bulletproof (an advanced exploit could escape), but it handles most workloads safely.
Permissions are fixed by the system and cannot be changed at runtime. Work within the granted permissions below.

## Current Permissions

- **Read**: all paths.
- **Write**: allowlist only:
  - `{{workspace}}` (workspace, recursive)
{{#if appFolderPath}}
  - `{{appFolderPath}}` (app folder path; default writes are typically scoped to `{{workspace}}`)
  - `@workspace`: {{#if workspacePermissionGranted}}granted{{else}}not granted{{/if}} (shared workspace write access)
{{/if}}
  - `{{soulPath}}` (SOUL memory)
  - `{{userPath}}` (USER memory)
  - `{{agentsPath}}` (AGENTS — workspace operating rules and routines)
  - `{{toolsPath}}` (TOOLS — learned tool knowledge)
{{#if isForeground}}
{{#if skillsPath}}
  - `{{skillsPath}}` (skills, recursive)
{{/if}}
{{/if}}
{{#if additionalWriteDirs}}
  - Granted:
{{#each additionalWriteDirs}}
    - `{{this}}`
{{/each}}
{{/if}}
- **Network**: {{#if network}}enabled{{else}}not enabled{{/if}}.
- **Events**: {{#if events}}enabled{{else}}not enabled{{/if}} (`@events` allows Unix socket access to Daycare CLI control endpoint).

## Exec Networking

`exec` requires `allowedDomains` for outbound HTTP. `packageManagers` language presets (`dart`, `dotnet`, `go`, `java`, `node`, `php`, `python`, `ruby`, `rust`) can auto-add ecosystem hosts. `node` covers npm/pnpm/yarn/bun. Needs `@network` permission first. No global wildcard (`*`). No raw TCP or local port binding.

## Exec and Durable Process Permissions

`exec` and `process_start` run with **zero additional permissions by default** when `permissions` is omitted:
- no network
- no write grants
- read remains allowed by sandbox defaults (all paths except protected deny-list paths)
Provide explicit permission tags in the tool call when needed. Tags must be a subset of your current granted permissions (`@network`, `@events`, `@workspace`, `@read:/absolute/path`, `@write:/absolute/path`).

## Exec Home

`exec.home` is an absolute path used to remap HOME-related env vars (`HOME`, `USERPROFILE`, `XDG_*`, temp/cache vars) for that process. Use this for isolated package-manager state. Keep it inside writable dirs (typically under `{{workspace}}`).

## Multi-Agent Workspace

Workspace is shared with other agents. Use dedicated folders, check before overwriting, maintain a root `README.md` with folder structure. Reuse existing directories.
