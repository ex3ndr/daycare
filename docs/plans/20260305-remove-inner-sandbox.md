# Remove Inner Sandboxes, Require Docker

## Overview
- Remove the `allowedDomains`/`packageManagers` network restriction system from exec — all networking is unrestricted
- Remove `@anthropic-ai/sandbox-runtime` inner sandbox — Docker is the only sandbox boundary
- Make Docker always required with hardcoded image `daycare-runtime:latest`
- Engine startup fails fast if `daycare-runtime` image is missing

## Context (from discovery)
- `allowedDomains` flows through: exec tool schema → `sandbox.exec()` → `sandboxAllowedDomainsResolve` → `runtime.ts` / `dockerRunInSandbox.ts` → `@anthropic-ai/sandbox-runtime` CLI
- Process tools (`find`, `ls`, `grep`) hardcode `allowedDomains: ["localhost"]`
- Plugins (`local-expose`, `cloudflare-tunnel`) pass domain allowlists to `processes.create()`
- `processTools.ts` exposes `allowedDomains` in `process_start` schema
- `@anthropic-ai/sandbox-runtime@0.0.34` is the inner sandbox dependency
- `runtime.ts` has two paths: CLI mode (with allowedDomains) and in-process `SandboxManager.wrapWithSandbox()` (without)
- `dockerRunInSandbox.ts` runs `/usr/local/bin/sandbox --settings ... -- command` inside Docker containers
- Docker is optional via `docker.enabled` (default `false`), image defaults to `daycare-sandbox`
- `sandboxFilesystemPolicyBuild.ts` builds filesystem deny/allow lists for inner sandbox
- `sandboxDockerEnvironmentIs.ts` detects container environment for nested sandbox decisions
- `processes.ts` stores `allowedDomains` per process, writes sandbox config JSON, spawns via SRT CLI

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- DB schema changes: allowedDomains column stays (avoid migration complexity), just stop using it

## Testing Strategy
- **Unit tests**: required for every task
- Tests run with `yarn test`
- Typecheck with `yarn typecheck`
- Lint with `yarn lint`

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Remove allowedDomains from sandbox core types and exec flow
- [x] Remove `allowedDomains` and `packageManagers` from `SandboxExecArgs` in `sandboxTypes.ts`
- [x] Remove domain resolution/validation logic from `Sandbox.exec()` in `sandbox.ts` (lines 212-217, network config in runtimeConfig)
- [x] Remove imports of `sandboxAllowedDomainsResolve` and `sandboxAllowedDomainsValidate` from `sandbox.ts`
- [x] Delete `sandboxAllowedDomainsResolve.ts` and `sandboxAllowedDomainsResolve.spec.ts`
- [x] Delete `sandboxAllowedDomainsValidate.ts`
- [x] Delete `sandboxPackageManagers.ts`
- [x] Update `sandbox.spec.ts` to remove allowedDomains test cases
- [x] Update `sandboxDocker.spec.ts` to remove allowedDomains test cases
- [x] Run tests — must pass before next task

### Task 2: Remove allowedDomains from shell tools
- [x] Remove `allowedDomains` and `packageManagers` from exec schema and description in `plugins/shell/tool.ts` (lines 99-124)
- [x] Stop passing `allowedDomains` to `sandbox.exec()` in `buildExecTool()` (line 386)
- [x] Remove `LOCALHOST_ALLOWED_DOMAINS` and `allowedDomains` usage from `findTool.ts`
- [x] Remove `LOCALHOST_ALLOWED_DOMAINS` and `allowedDomains` usage from `lsTool.ts`
- [x] Remove `LOCALHOST_ALLOWED_DOMAINS` and `allowedDomains` usage from `grepTool.ts`
- [x] Update `tool.spec.ts`, `findTool.spec.ts`, `lsTool.spec.ts`, `grepTool.spec.ts` to remove allowedDomains references
- [x] Run tests — must pass before next task

### Task 3: Remove allowedDomains from processes and plugins
- [x] Remove `allowedDomains` and `packageManagers` from `ProcessCreateInput` in `processes.ts`
- [x] Remove `allowedDomains` from `ProcessRecord` in `processes.ts`
- [x] Remove `sandboxAllowedDomainsResolve`/`sandboxAllowedDomainsValidate` imports and usage from `processes.ts`
- [x] Remove `allowedDomains` param from `buildSandboxConfig` in `processes.ts`
- [x] Remove `allowedDomains` from `processStartSchema` in `processTools.ts`
- [x] Stop passing `allowedDomains` in `processTools.ts` create call
- [x] Remove `allowedDomains` from `local-expose/plugin.ts` process creation
- [x] Remove `allowedDomains` from `cloudflare-tunnel/plugin.ts` process creation
- [x] Remove `allowedDomains` from `ProcessDbRecord` in `databaseTypes.ts` (keep DB column, stop reading/writing)
- [x] Remove `allowedDomains` handling from `processesRepository.ts`
- [x] Update `processes.spec.ts`, `processTools.spec.ts`, `local-expose/plugin.spec.ts`, `cloudflare-tunnel/plugin.spec.ts` tests
- [x] Run tests — must pass before next task

### Task 4: Remove inner sandbox (sandbox-runtime)
- [x] Rewrite `runtime.ts`: replace `runInSandbox` with direct `exec`/`execFile` (no SRT wrapping), remove `SandboxManager` usage
- [x] Rewrite `dockerRunInSandbox.ts`: replace `sandbox --settings ... -- command` with direct `bash -lc <command>`, remove settings JSON file creation/cleanup
- [x] Remove `sandboxFilesystemPolicyBuild` usage from `sandbox.ts` exec method
- [x] Delete `sandboxFilesystemPolicyBuild.ts` and its spec
- [x] Delete `sandboxDockerEnvironmentIs.ts` and `sandboxDockerEnvironmentIs.spec.ts`
- [x] Remove `enableWeakerNestedSandbox` from `SandboxDockerConfig` in `sandboxTypes.ts`
- [x] Remove `enableWeakerNestedSandbox` from runtimeConfig building in `sandbox.ts`
- [x] Remove `sandboxDockerEnvironmentIs` usage from `processes.ts`, remove `enableWeakerNestedSandbox` from `buildSandboxConfig`
- [x] Remove `@anthropic-ai/sandbox-runtime` from `package.json`
- [x] Update `runtime.spec.ts`, `dockerRunInSandbox.spec.ts`, `processes.spec.ts` tests
- [x] Run tests — must pass before next task

### Task 5: Make Docker always required, hardcode image to daycare-runtime
- [x] Remove `enabled`, `image`, `tag`, `enableWeakerNestedSandbox` from `DockerSettings` and `ResolvedDockerSettings` in `settings.ts`
- [x] Update `configResolve.ts`: remove `DEFAULT_DOCKER_IMAGE`/`DEFAULT_DOCKER_TAG` constants, hardcode `daycare-runtime:latest`, remove `enabled`/`enableWeakerNestedSandbox` from defaults
- [x] Update `configSettingsParse.ts`: remove `enabled`, `image`, `tag`, `enableWeakerNestedSandbox` from zod schema
- [x] Remove `enabled` from `SandboxDockerConfig` in `sandboxTypes.ts`, make `docker` required (not optional) in `SandboxConfig`
- [x] Update `sandbox.ts`: remove all `this.docker?.enabled` checks — Docker is always on, `docker` is always defined
- [x] Update `agent.ts` `sandboxBuild()`: remove `dockerSettings?.enabled` conditional, always pass docker config, remove `image`/`tag`/`enableWeakerNestedSandbox`
- [x] Update `engine.ts` startup: remove `if (docker.enabled)` guard, hardcode image ref `daycare-runtime:latest`, add image existence validation
- [x] Update `dockerContainerEnsure.ts` and `dockerImageIdResolve.ts` to use hardcoded image
- [x] Remove `dockerEnabled` checks from `agentSystemPromptSectionToolCalling.ts`, `agentSystemPromptSectionEnvironment.ts`, `agentSystemPromptSectionPermissions.ts`
- [x] Update `configResolve.spec.ts`, `configSettingsParse.spec.ts`, `sandboxDocker.spec.ts`, `appLink.spec.ts` tests
- [x] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [x] Verify all requirements from Overview are implemented
- [x] Verify edge cases are handled
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`) — all issues must be fixed
- [x] Run typecheck (`yarn typecheck`)

### Task 7: [Final] Update documentation
- [x] Update `sources/sandbox/README.md` to reflect Docker-only model
- [x] Update `sources/sandbox/docker/README.md` to remove optional Docker references and allowedDomains
- [x] Update `sources/prompts/SYSTEM_PERMISSIONS.md` to remove allowedDomains references
- [x] Update any skill docs referencing allowedDomains

## Technical Details

### Exec flow after changes
1. `sandbox.exec()` receives command + env + cwd
2. Always delegates to `dockerRunInSandbox()` (no non-Docker path)
3. `dockerRunInSandbox()` runs `bash -lc <command>` directly in the per-user Docker container (no sandbox-runtime wrapper)
4. Network is unrestricted — no domain filtering

### Docker config after changes
- Image: always `daycare-runtime:latest` (hardcoded, not configurable)
- Remaining settings: `socketPath`, `runtime`, `readOnly`, `unconfinedSecurity`, `capAdd`, `capDrop`, `allowLocalNetworkingForUsers`, `isolatedDnsServers`, `localDnsServers`
- Engine startup validates image exists locally, fails fast with clear error if missing

### DB schema
- `allowed_domains` column stays in processes table (avoid migration)
- Code stops reading/writing it
- Default empty array `[]` for new records

## Post-Completion

**Manual verification:**
- Test engine startup without `daycare-runtime` image — should fail with clear error
- Test agent exec with network access — should work without domain restrictions
- Test process start/stop lifecycle without sandbox-runtime
