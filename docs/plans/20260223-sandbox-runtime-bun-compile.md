# Build sandbox-runtime as standalone binary via bun compile

## Overview
- Replace the `npm install -g @anthropic-ai/sandbox-runtime` step in the Docker image with a pre-compiled standalone binary built using `bun build --compile`
- Eliminates the runtime dependency on Node.js for sandbox execution inside the container
- Removes the CLI path resolution docker exec call (saves one exec per sandbox command)
- Binary + vendor seccomp files placed under `/usr/local/lib/srt/`, symlinked to `/usr/local/bin/srt`

## Context (from discovery)
- **Dockerfiles**: `packages/daycare-runtime/Dockerfile` (full) and `Dockerfile.minimal`
- **Sandbox runtime**: `@anthropic-ai/sandbox-runtime@0.0.34` — CLI at `dist/cli.js`, vendor seccomp binaries at `vendor/seccomp/{x64,arm64}/`
- **Docker invocation code**: `packages/daycare/sources/sandbox/docker/dockerRunInSandbox.ts` — currently does two docker execs: one to resolve CLI path via `node -p "require.resolve(...)"`, one to run `node <path> --settings ...`
- **Image version guard**: `packages/daycare/sources/sandbox/docker/dockerImageVersion.ts` — `DOCKER_IMAGE_VERSION = "1"`
- **Tests**: `dockerRunInSandbox.spec.ts` — mocks two exec calls (resolve + run), needs updating to single exec
- **Seccomp auto-discovery**: `generate-seccomp-filter.js` resolves vendor files relative to `import.meta.url` (dirname of binary), checking `join(baseDir, 'vendor', 'seccomp', arch, filename)` first

## Development Approach
- **Testing approach**: Regular (code first, then update tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add bun compile builder stage to both Dockerfiles
- [x] Add `FROM oven/bun:1 AS srt-builder` stage at the top of `Dockerfile`
  - `WORKDIR /build`
  - `RUN bun init -y && bun add @anthropic-ai/sandbox-runtime@0.0.34`
  - `RUN bun build --compile node_modules/@anthropic-ai/sandbox-runtime/dist/cli.js --outfile srt`
- [x] After the BASE section, add steps to install the compiled binary:
  - `COPY --from=srt-builder /build/srt /usr/local/lib/srt/srt`
  - `COPY --from=srt-builder /build/node_modules/@anthropic-ai/sandbox-runtime/vendor /usr/local/lib/srt/vendor`
  - `RUN chmod +x /usr/local/lib/srt/srt && ln -s /usr/local/lib/srt/srt /usr/local/bin/srt`
- [x] Remove `npm install -g @anthropic-ai/sandbox-runtime` from the NODE section
- [x] Apply the same changes to `Dockerfile.minimal`
- [x] Verify Dockerfile syntax is valid (`docker build --check` or similar)

### Task 2: Update dockerRunInSandbox.ts to use fixed binary path
- [x] Add constant `const SRT_CONTAINER_PATH = "/usr/local/bin/srt"` in `dockerRunInSandbox.ts`
- [x] Remove the first docker exec call that resolves the CLI path via `require.resolve`
- [x] Remove the `cliPathResolveFromResult` helper function
- [x] Change the command from `["bash", "-lc", "node <srtCliPath> --settings ..."]` to `["bash", "-lc", "/usr/local/bin/srt --settings ..."]`
- [x] Update tests in `dockerRunInSandbox.spec.ts`:
  - Change from two mock exec calls to one (remove the CLI resolution mock)
  - Update the command assertion to check for `/usr/local/bin/srt` instead of `node <path>`
- [x] ➕ Update `dockerRunInSandbox.integration.spec.ts` to assert runnable `srt` binary in Docker image
- [x] Run tests — must pass before next task

### Task 3: Bump DOCKER_IMAGE_VERSION
- [x] Change `DOCKER_IMAGE_VERSION` from `"1"` to `"2"` in `dockerImageVersion.ts`
- [x] Update any tests that assert on the version value (check `dockerContainerEnsure.spec.ts`)
- [x] Run tests — must pass before next task

### Task 4: Verify acceptance criteria
- [x] Verify all requirements from Overview are implemented
- [x] Run full test suite (unit tests)
- [x] Run linter (`yarn lint`)
- [x] Run typecheck (`yarn typecheck`)

### Task 5: [Final] Update documentation
- [x] Update `packages/daycare-runtime/README.md` — change "Node setup installs global @anthropic-ai/sandbox-runtime" to mention bun-compiled binary
- [x] Update any doc references to the sandbox-runtime installation method

## Technical Details

### Binary Layout in Container
```
/usr/local/lib/srt/
├── srt                        # bun-compiled standalone binary
└── vendor/
    └── seccomp/
        ├── x64/
        │   ├── unix-block.bpf
        │   └── apply-seccomp
        └── arm64/
            ├── unix-block.bpf
            └── apply-seccomp
/usr/local/bin/srt -> /usr/local/lib/srt/srt   # symlink
```

### Seccomp Auto-Discovery
The sandbox-runtime's `generate-seccomp-filter.js` resolves vendor files relative to `dirname(fileURLToPath(import.meta.url))`. In a bun-compiled binary at `/usr/local/lib/srt/srt`, this resolves to `/usr/local/lib/srt/`. The first lookup path `join(baseDir, 'vendor', 'seccomp', arch, filename)` finds the files at `/usr/local/lib/srt/vendor/seccomp/{arch}/{file}` — no config changes needed.

### Docker Command Flow (Before → After)
**Before** (2 docker execs):
1. `docker exec: bash -lc 'node -p "require.resolve(...)"'` → resolve CLI path
2. `docker exec: bash -lc 'node /resolved/cli.js --settings /path -c "cmd"'` → run command

**After** (1 docker exec):
1. `docker exec: bash -lc '/usr/local/bin/srt --settings /path -c "cmd"'` → run command directly

### Architecture Handling
The `oven/bun:1` builder stage runs natively on the target architecture (via Docker buildx). No cross-compilation flags needed — `bun build --compile` produces a binary for the current platform.

## Post-Completion

**Manual verification:**
- Build both Docker images locally to verify the srt binary works
- Run `docker run --rm daycare-runtime:latest /usr/local/bin/srt --help` to verify the binary is functional
- Test sandbox execution end-to-end with a real container
