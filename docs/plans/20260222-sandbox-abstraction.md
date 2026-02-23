# Sandbox Abstraction

## Overview
Create a `Sandbox` class that unifies file read, file write, and command execution behind a single abstraction. The class is instantiated per-agent from `Config` + `Context` (+ `UserHome` / `SessionPermissions`) and provides three core methods: `read`, `write`, and `exec`. It becomes the single I/O layer that all consumers (shell tools, connectors, skills) use instead of directly touching the filesystem or sandbox runtime.

Key design decisions:
- **Sandbox is a lower layer** — shell tools add LLM formatting on top; connectors and skills call it directly
- **Path mapping is internal** — read/write operate on host paths, exec runs inside the sandbox runtime. The Sandbox resolves agent-visible paths to host paths transparently
- **Per-agent lifecycle** — created once when an Agent is created/restored, shared across all tool calls
- **Moves I/O to `sandbox` on `ToolExecutionContext`** — runtime paths use `sandbox`; `permissions` + `fileStore` compatibility fields were removed
- **workingDir vs homeDir** — these are distinct concepts:
  - `workingDir` = `userHome.desktop` (e.g. `/data/users/uid/home/desktop`) — where relative paths resolve, the agent's CWD
  - `homeDir` = `userHome.home` (e.g. `/data/users/uid/home/`) — the broader root for writes, sandbox home for exec, contains downloads/desktop/documents/etc.
  - Writes are allowed anywhere under `homeDir`, but the agent's default CWD is `workingDir` (a subdirectory of home)

## Context (from discovery)
- **Shell tools**: `plugins/shell/tool.ts` — `buildWorkspaceReadTool`, `buildWorkspaceWriteTool`, `buildExecTool` currently own all I/O logic inline
- **Sandbox runtime**: `sandbox/runtime.ts` — `runInSandbox()` wraps `@anthropic-ai/sandbox-runtime`
- **Path security**: `sandbox/pathResolveSecure.ts`, `sandboxCanRead.ts`, `sandboxCanWrite.ts` — permission checks
- **Permissions**: `engine/permissions.ts` — `SessionPermissions` type (`workingDir`, `writeDirs`, `readDirs`)
- **UserHome**: `engine/users/userHome.ts` — resolves all per-user home paths
- **Files/FileFolder**: `engine/files/files.ts`, `fileFolder.ts` — user-scoped downloads/desktop/tmp
- **ToolExecutionContext**: `engine/modules/tools/types.ts` — now uses `sandbox` only for tool I/O
- **Context assembly**: `engine/agents/ops/agentLoopRun.ts:615` — where ToolExecutionContext is built inline

## Development Approach
- **Testing approach**: TDD
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- ➕ Follow-up: removed temporary `ToolExecutionContext.permissions`/`fileStore` compatibility shims after migration

## Implementation Steps

### Task 1: Define Sandbox types and create the Sandbox class skeleton
- [x] Create `sources/sandbox/sandboxTypes.ts` with `SandboxConfig`, `SandboxReadArgs`, `SandboxWriteArgs`, `SandboxExecArgs`, `SandboxReadResult`, `SandboxWriteResult`, `SandboxExecResult` types
- [x] Create `sources/sandbox/sandbox.ts` with the `Sandbox` class:
  - Constructor takes `SandboxConfig`: `{ homeDir: string; permissions: SessionPermissions; }`
    - `homeDir` — absolute path to user home (e.g. `/data/users/uid/home/`), used as sandbox exec home and write root
    - `workingDir` — always derived from `permissions.workingDir` and cannot be overridden via constructor config
    - `permissions` — the full `SessionPermissions` for permission checks
  - Stub methods: `read(args: SandboxReadArgs): Promise<SandboxReadResult>`, `write(args: SandboxWriteArgs): Promise<SandboxWriteResult>`, `exec(args: SandboxExecArgs): Promise<SandboxExecResult>`
  - Expose `readonly permissions: SessionPermissions` for consumers that still need raw access during migration
  - Expose `readonly homeDir: string` and `readonly workingDir: string`
- [x] Write tests for Sandbox construction (valid config, permissions accessible)
- [x] Run tests — must pass before next task

### Task 2: Implement `Sandbox.read()`
- [x] Extract the core read logic from `handleReadSecure` in `plugins/shell/tool.ts` into `Sandbox.read()`:
  - Path resolution: resolve relative paths against `permissions.workingDir`, handle `~` expansion
  - Permission check via `sandboxCanRead()`
  - TOCTOU-safe file reading via `openSecure()`
  - Return `SandboxReadResult` with `{ content: string, bytes: number, totalLines: number, truncated: boolean }` (for text) or `{ content: Buffer, bytes: number, mimeType: string }` (for images)
- [x] Handle offset/limit pagination in `Sandbox.read()`
- [x] Handle image detection and binary read
- [x] Write tests for `Sandbox.read()`: successful text read, image read, offset/limit, path outside permissions (error), symlink rejection
- [x] Run tests — must pass before next task

### Task 3: Implement `Sandbox.write()`
- [x] Extract core write logic from `handleWriteSecure` in `plugins/shell/tool.ts` into `Sandbox.write()`:
  - Path must be absolute, resolved against permissions
  - Permission check via `sandboxCanWrite()`
  - TOCTOU-safe write (mkdir + lstat + open)
  - Support append mode
  - Return `SandboxWriteResult` with `{ bytes: number, path: string }`
- [x] Write tests for `Sandbox.write()`: successful write, append mode, path outside permissions (error), symlink rejection, creates parent dirs
- [x] Run tests — must pass before next task

### Task 4: Implement `Sandbox.exec()`
- [x] Extract core exec logic from `buildExecTool` execute handler into `Sandbox.exec()`:
  - Build sandbox filesystem policy from permissions
  - Resolve cwd against `workingDir` (default cwd if not provided)
  - Use `homeDir` as the sandbox HOME (passed to `runInSandbox` via `home` option) — this is always set, not user-overridable
  - Build network allowlist from args (domains + package managers)
  - Call `runInSandbox()` with resolved config
  - Return `SandboxExecResult` with `{ stdout: string, stderr: string, exitCode: number | null, signal: string | null }`
- [x] Accept optional overrides: `env`, `timeoutMs`, `cwd`, `packageManagers`, `allowedDomains` (NOT home — Sandbox owns home via `homeDir`)
- [x] Write tests for `Sandbox.exec()`: successful command, failed command with exit code, timeout, cwd resolution, domain validation
- [x] Run tests — must pass before next task

### Task 5: Add `sandbox` to `ToolExecutionContext` and remove `permissions` + `fileStore`
- [x] Update `ToolExecutionContext` in `engine/modules/tools/types.ts`: add `sandbox: Sandbox` as the primary I/O field and remove `permissions` / `fileStore` fields
- [x] Update `agentLoopRun.ts` tool context assembly (line 615) to pass `sandbox`
- [x] Update `agent.ts` `rlmRestoreContextBuild()` to pass `sandbox`
- [x] Create the `Sandbox` instance on `Agent` (in constructor and `restore()`), stored as a field
- [x] Write tests verifying Sandbox is correctly wired into ToolExecutionContext
- [x] Run tests — must pass before next task

### Task 6: Migrate shell tools to use `Sandbox`
- [x] Refactor `buildWorkspaceReadTool` to call `toolContext.sandbox.read()` instead of inline I/O
- [x] Refactor `buildWorkspaceWriteTool` to call `toolContext.sandbox.write()` instead of inline I/O
- [x] Refactor `buildWorkspaceEditTool` — edit still uses sandbox.read() + sandbox.write() (read-modify-write)
- [x] Refactor `buildExecTool` to call `toolContext.sandbox.exec()` instead of inline sandbox setup
- [x] Remove `home` parameter from the LLM-facing exec tool schema (`execSchema` in `tool.ts:82`) — Sandbox owns home via `homeDir`, the LLM must not override it
- [x] Remove `home` from the exec tool description string (`tool.ts:200`)
- [x] Remove `home` handling from the exec execute handler (`tool.ts:218` — `resolveWritePathSecure` for home)
- [x] Shell tools retain their schema definitions (minus `home`), LLM formatting, and `ToolDefinition` structure — only I/O delegates to Sandbox
- [x] Update existing shell tool tests (`tool.spec.ts`) to work with new Sandbox-based context
- [x] Run tests — must pass before next task

### Task 7: Migrate connectors and other consumers
- [x] Update file-producing tool flows to use `Sandbox.write()` and direct `~/downloads` writes (no `sandbox.files` indirection)
- [x] Update skill loading (`skillResolve.ts`) to use Sandbox.read() when reading skill files (if applicable — skills may read outside agent scope so evaluate whether this makes sense)
- [x] Update any other consumers that directly access `toolContext.permissions` or `toolContext.fileStore`
- [x] Audit all imports of `sandboxCanRead`, `sandboxCanWrite` — these should now be internal to Sandbox only
- [x] Write tests for connector file storage through Sandbox
- [x] Run tests — must pass before next task

### Task 8: Verify acceptance criteria
- [x] Verify all 3 operations (read, write, exec) work through Sandbox
- [x] Verify path rewriting is internal — no consumer needs to know about host vs sandbox paths
- [x] Verify shell tools still produce identical LLM output
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run type check (`yarn typecheck`)

### Task 9: [Final] Update documentation
- [x] Add `README.md` to `sources/sandbox/` documenting the Sandbox class, its API, and usage patterns
- [x] Update `doc/PLUGINS.md` if plugin API changes affect how plugins access I/O
- [x] Add mermaid diagram showing Sandbox as the I/O layer between tools/connectors and the filesystem/runtime

## Technical Details

### Sandbox Class Shape

```typescript
// sources/sandbox/sandboxTypes.ts

export type SandboxReadArgs = {
    path: string;
    offset?: number;
    limit?: number;
};

export type SandboxReadResultText = {
    type: "text";
    content: string;
    bytes: number;
    totalLines: number;
    outputLines: number;
    truncated: boolean;
    truncatedBy: "lines" | "bytes" | null;
};

export type SandboxReadResultImage = {
    type: "image";
    content: Buffer;
    bytes: number;
    mimeType: string;
};

export type SandboxReadResult = SandboxReadResultText | SandboxReadResultImage;

export type SandboxWriteArgs = {
    path: string;
    content: string;
    append?: boolean;
};

export type SandboxWriteResult = {
    bytes: number;
    resolvedPath: string;
};

export type SandboxExecArgs = {
    command: string;
    cwd?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
    packageManagers?: string[];
    allowedDomains?: string[];
};

export type SandboxExecResult = {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    failed: boolean;
};
```

```typescript
// sources/sandbox/sandboxTypes.ts (additional)

export type SandboxConfig = {
    /** Absolute path to user home root (e.g. /data/users/uid/home/). Write root + exec home. */
    homeDir: string;
    /** Full permission set for read/write checks. */
    permissions: SessionPermissions;
};
```

```typescript
// sources/sandbox/sandbox.ts

export class Sandbox {
    readonly homeDir: string;
    readonly workingDir: string;
    readonly permissions: SessionPermissions;

    constructor(config: SandboxConfig) {
        this.homeDir = config.homeDir;
        this.workingDir = path.resolve(config.permissions.workingDir);
        this.permissions = config.permissions;
    }

    /** Read a file from the host filesystem. Resolves relative paths against workingDir. */
    async read(args: SandboxReadArgs): Promise<SandboxReadResult> { /* ... */ }

    /** Write a file to the host filesystem. Path must be absolute and within allowed write dirs. */
    async write(args: SandboxWriteArgs): Promise<SandboxWriteResult> { /* ... */ }

    /**
     * Execute a command inside the sandboxed runtime.
     * Uses homeDir as the sandbox HOME. Uses workingDir as default cwd.
     */
    async exec(args: SandboxExecArgs): Promise<SandboxExecResult> { /* ... */ }
}
```

### Architecture Diagram

```mermaid
graph TD
    A[Shell Tools<br/>read/write/edit/exec] --> S[Sandbox]
    B[Connectors<br/>telegram/whatsapp] --> S
    C[Skills<br/>skill loading] --> S

    S --> R["sandbox.read()<br/>resolves relative paths against workingDir<br/>reads from host filesystem"]
    S --> W["sandbox.write()<br/>writes under homeDir tree<br/>host filesystem"]
    S --> E["sandbox.exec()<br/>cwd defaults to workingDir<br/>HOME = homeDir"]

    R --> PC[Path Security<br/>sandboxCanRead/Write]
    W --> PC
    E --> RT[runInSandbox<br/>@anthropic-ai/sandbox-runtime]

    subgraph "Sandbox State"
        HD["homeDir<br/>/data/users/uid/home/<br/>(write root, exec HOME)"]
        WD["workingDir<br/>/data/users/uid/home/desktop<br/>(agent CWD, path resolution)"]
        P[SessionPermissions]
    end

    S --> HD
    S --> WD
    S --> P
    S --> W
```

### ToolExecutionContext Change

```typescript
// Before
export type ToolExecutionContext = {
    permissions: SessionPermissions;  // removed
    fileStore: FileFolder;            // removed
    // ... other fields
};

// After
export type ToolExecutionContext = {
    sandbox: Sandbox;                 // primary I/O
    // ... other fields unchanged
};
```

### Agent Integration

```typescript
// In Agent constructor / restore:
this.sandbox = new Sandbox({
    homeDir: this.userHome.home,              // /data/users/uid/home/ — write root, exec HOME
    permissions: state.permissions
});

// In agentLoopRun.ts tool execution:
const toolResult = await toolResolver.execute(toolCall, {
    sandbox: agent.sandbox,
    // ... other fields
});
```

## Post-Completion

**Manual verification:**
- Test with a running agent: send a message that triggers read/write/exec tools
- Verify connector file downloads still work (send a file via Telegram)
- Verify skill loading still works

**Future work (out of scope):**
- True filesystem virtualization for sandboxed exec (different host vs sandbox paths)
- Sandbox-level audit logging for all I/O operations
- Per-operation permission granularity (beyond directory-level)
