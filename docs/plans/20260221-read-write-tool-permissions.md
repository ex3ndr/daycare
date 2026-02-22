# Fix Read/Write Tool Permissions to Align with Sandbox

## Overview
- The read and write tools currently bypass the deny-list protections that the exec sandbox enforces
- Read tool allows reading any file on the filesystem (including SSH keys, AWS credentials, etc.)
- Write tool allows writing to sensitive paths (`.ssh`, `.gnupg`, etc.) if the parent directory is in `writeDirs`
- The exec sandbox (via `sandboxFilesystemPolicyBuild` + `@anthropic-ai/sandbox-runtime`) already denies access to these sensitive paths — the read/write tools should be aligned
- Additionally, deny OS home directory (`os.homedir()`) by default for reads, allowing only workspace paths (workingDir/writeDirs)

## Context
- `sandboxCanRead.ts` uses `[path.parse(target).root]` as allowed dirs — effectively allows reading everything
- `sandboxCanWrite.ts` uses `permissions.writeDirs` but has no deny-list
- `sandboxFilesystemPolicyBuild.ts` defines comprehensive deny lists but is only used by the exec tool
- `@anthropic-ai/sandbox-runtime` has built-in dangerous files list (shell configs, git hooks, IDE dirs) that are always write-blocked
- `permissionBuildUser.ts` sets `writeDirs: [userHome.home]` — home dir is writable by default

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with + prefix
- Document issues/blockers with ! prefix

## Implementation Steps

### Task 1: Extract sensitive deny paths into reusable function

Create `sandboxSensitiveDenyPathsBuild.ts` that extracts the deny-path building logic from `sandboxFilesystemPolicyBuild.ts` so it can be shared between exec and read/write tools.

- [x] Create `sources/sandbox/sandboxSensitiveDenyPathsBuild.ts`
  - Input: `{ homeDir?: string; platform?: NodeJS.Platform }`
  - Output: `string[]` — list of absolute paths that should be denied
  - Contains: all sensitive home-relative paths (`.ssh`, `.gnupg`, `.aws`, `.kube`, `.docker`, etc.) and platform-specific system paths (`/etc/ssh`, `/etc/shadow`, etc.)
  - Does NOT include app deny paths (those are handled separately by `sandboxAppsDenyPathsBuild`)
- [x] Refactor `sandboxFilesystemPolicyBuild.ts` to import and use `sandboxSensitiveDenyPathsBuild` instead of inline constants
- [x] Verify `sandboxFilesystemPolicyBuild.spec.ts` still passes (no behavior change)
- [x] Write tests for `sandboxSensitiveDenyPathsBuild` (verify all paths are included, platform branching works)
- [x] Run tests — must pass before next task

### Task 2: Extract sandbox runtime dangerous files into reusable list

Create `sandboxDangerousFilesBuild.ts` that replicates the `@anthropic-ai/sandbox-runtime` built-in dangerous files list. These are files that should never be written even within allowed write directories.

- [x] Create `sources/sandbox/sandboxDangerousFilesBuild.ts`
  - Output: `{ files: string[]; directories: string[] }`
  - Files: `.gitconfig`, `.gitmodules`, `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`, `.profile`, `.ripgreprc`, `.mcp.json`
  - Directories: `.vscode`, `.idea`, `.claude/commands`, `.claude/agents`, `.git/hooks`
  - These are relative filenames/dirnames, checked against any path's basename/segments
- [x] Write tests for `sandboxDangerousFilesBuild`
- [x] Run tests — must pass before next task

### Task 3: Create path deny check function

Create `sandboxPathDenyCheck.ts` — a pure function that checks if a resolved path falls within any denied directory or matches a dangerous file pattern.

- [x] Create `sources/sandbox/sandboxPathDenyCheck.ts`
  - `sandboxPathDenyCheck(target: string, denyPaths: string[]): boolean`
  - Uses `isWithinSecure` to check if target is within any denied directory
  - Returns `true` if the path should be denied
- [x] Create `sources/sandbox/sandboxDangerousFileCheck.ts`
  - `sandboxDangerousFileCheck(target: string, dangerous: { files: string[]; directories: string[] }): boolean`
  - Checks if the target path's basename matches a dangerous file
  - Checks if the target path contains a dangerous directory segment
  - Returns `true` if the path should be denied
- [x] Write tests for `sandboxPathDenyCheck` (paths within denied dirs, paths outside, edge cases)
- [x] Write tests for `sandboxDangerousFileCheck` (matching basenames, directory segments, non-matches)
- [x] Run tests — must pass before next task

### Task 4: Update `sandboxCanRead` to enforce deny lists

Add sensitive-path deny list and OS home directory deny to the read tool.

Check order:
1. Resolve path securely (existing)
2. Check app isolation (existing)
3. Check sensitive deny list — DENY if match
4. Check if within workingDir or writeDirs — ALLOW
5. Check if within OS home directory — DENY
6. ALLOW (system paths outside home)

- [x] Update `sandboxCanRead.ts`:
  - Import `sandboxSensitiveDenyPathsBuild` and `sandboxPathDenyCheck`
  - After app isolation check, build deny list and check target
  - After deny check, check if target is within workingDir or writeDirs — if so, allow
  - If target is within `os.homedir()` and NOT in workingDir/writeDirs — deny
  - Otherwise allow
- [x] Update `sandboxCanRead.spec.ts`:
  - Test: denies reading sensitive paths (e.g., `~/.ssh/id_rsa`)
  - Test: denies reading files in OS home directory by default
  - Test: allows reading files within workingDir even if inside home
  - Test: allows reading files within writeDirs even if inside home
  - Test: allows reading system paths outside home (e.g., `/tmp/foo`)
  - Test: existing app isolation tests still pass
- [x] Run tests — must pass before next task

### Task 5: Update `sandboxCanWrite` to enforce deny lists

Add sensitive-path deny list and sandbox runtime dangerous-files check to the write tool.

Check order:
1. Resolve path securely against writeDirs (existing)
2. Check app isolation (existing)
3. Check sensitive deny list — DENY if match
4. Check dangerous files list — DENY if match
5. ALLOW (already within writeDirs from step 1)

- [x] Update `sandboxCanWrite.ts`:
  - Import `sandboxSensitiveDenyPathsBuild`, `sandboxPathDenyCheck`, `sandboxDangerousFilesBuild`, `sandboxDangerousFileCheck`
  - After app isolation check, run deny checks on the resolved path
  - If path matches sensitive deny or dangerous file — throw error
- [x] Update `sandboxCanWrite.spec.ts`:
  - Test: denies writing to sensitive paths even when parent is in writeDirs
  - Test: denies writing to dangerous files (e.g., `.bashrc`, `.gitconfig`) even in writeDirs
  - Test: denies writing to dangerous directories (e.g., `.git/hooks/pre-commit`) even in writeDirs
  - Test: allows writing to normal files within writeDirs (existing behavior preserved)
  - Test: existing app isolation tests still pass
- [x] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [x] Verify: read tool denies access to `~/.ssh/id_rsa`
- [x] Verify: read tool denies access to random file in OS home dir (e.g., `~/random.txt`)
- [x] Verify: read tool allows access to workspace files
- [x] Verify: write tool denies writing `.bashrc` within workspace
- [x] Verify: write tool denies writing to `~/.ssh/authorized_keys` even if home is in writeDirs
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run type check (`yarn typecheck`)

### Task 7: Update documentation
- [x] Update sandbox README if it exists (`sources/sandbox/README.md` not present; updated `doc/internals/read-write-permission-alignment.md`)
- [x] Add brief comment in `sandboxCanRead.ts` and `sandboxCanWrite.ts` explaining the deny-list policy

## Technical Details

### Read Tool Permission Model (after change)
```
resolveSecure(target) → deny(sensitive) → allow(workingDir | writeDirs) → deny(homeDir) → allow
```

### Write Tool Permission Model (after change)
```
resolveSecure(target, writeDirs) → deny(sensitive) → deny(dangerousFiles) → allow
```

### Sensitive Deny Paths (from sandboxFilesystemPolicyBuild)
Home-relative: `.ssh`, `.gnupg`, `.aws`, `.kube`, `.docker`, `.config/gcloud`, `.config/gh`, `.config/op`, `.config/1Password`, `.local/share/keyrings`, `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials`

Platform system: `/etc/ssh`, `/etc/sudoers`, `/etc/shadow`, `/etc/gshadow`, `/etc/ssl/private` + macOS/Linux variants

### Dangerous Files (from sandbox runtime)
Files: `.gitconfig`, `.gitmodules`, `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`, `.profile`, `.ripgreprc`, `.mcp.json`

Directories: `.vscode`, `.idea`, `.claude/commands`, `.claude/agents`, `.git/hooks`

## Post-Completion

**Manual verification:**
- Test with a running agent that the read tool correctly denies `~/.ssh/id_rsa`
- Test that workspace files are still readable
- Test that write operations to normal workspace files still work
- Verify exec sandbox behavior is unchanged
