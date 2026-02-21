# Replace FileStore with Files Facade

## Overview
Replace the `FileStore` class with a `Files` facade that owns three `FileFolder` wrappers: `downloads`, `desktop`, and `tmp`. Move the module from `sources/files/` to `sources/engine/files/`. Add a `tmp` directory to the user home structure.

## Context
- **Current implementation**: `FileStore` in `sources/files/store.ts` — a class with `saveBuffer`, `saveFromPath`, `ensureDir`, `resolvePath`
- **Used in**: `agent.ts`, `engine.ts`, `agentSystem.ts`, `PluginManager`, `ProviderManager`, connector plugins (telegram, whatsapp), tool modules (image-generation, mermaid-png, send-file, sayFileResolve), commands (add, doctor), and ~15 test files
- **Current home dirs**: `desktop`, `downloads`, `documents`, `developer`, `knowledge` — no `tmp`
- **Engine has its own FileStore** at `dataDir/files` for provider scratch space

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Create FileFolder and Files classes in `sources/engine/files/`
- [ ] Create `sources/engine/files/fileFolder.ts` — lightweight class with `saveBuffer(options)` and `saveFromPath(options)` (same logic as current `FileStore`, returns `StoredFile`)
- [ ] Create `sources/engine/files/files.ts` — `Files` facade class: constructor takes `homePath: string`, exposes `readonly downloads: FileFolder`, `readonly desktop: FileFolder`, `readonly tmp: FileFolder` (paths: `<homePath>/downloads`, `<homePath>/desktop`, `<homePath>/tmp`)
- [ ] Keep `StoredFile` and `FileReference` types in `sources/files/types.ts` (or move to `sources/engine/files/types.ts`)
- [ ] Write tests for `fileFolder.ts` (saveBuffer success, saveFromPath success)
- [ ] Write tests for `files.ts` (constructor resolves correct paths, each folder works)
- [ ] Run tests — must pass before next task

### Task 2: Add `tmp` to UserHome and userHomeEnsure
- [ ] Add `readonly tmp: string` to `UserHome` class, set to `path.join(this.home, "tmp")`
- [ ] Add `fs.mkdir(userHome.tmp, ...)` to `userHomeEnsure`
- [ ] Run tests — must pass before next task

### Task 3: Replace FileStore usage in Agent
- [ ] In `agent.ts`: replace `private readonly fileStore: FileStore` with `private readonly files: Files`
- [ ] Construct `Files` with `this.userHome.home` instead of `new FileStore(this.userHome.downloads)`
- [ ] Update all references from `this.fileStore` to `this.files.downloads` (or `.desktop`/`.tmp` where appropriate)
- [ ] Update `agentLoopRun` context to pass `files` (or keep passing individual FileFolder as `fileStore` for now to minimize blast radius)
- [ ] Run tests — must pass before next task

### Task 4: Replace FileStore in Engine and AgentSystem
- [ ] In `engine.ts`: replace `FileStore` with `Files` (engine-level files at `dataDir/files` — may need a standalone `FileFolder` here since engine isn't user-scoped)
- [ ] In `agentSystem.ts`: update `fileStore: FileStore` to use `FileFolder` or `Files` in options type
- [ ] Update `PluginManager`, `ProviderManager` types to accept `FileFolder` instead of `FileStore`
- [ ] Run tests — must pass before next task

### Task 5: Update all remaining consumers
- [ ] Update connector plugins (telegram, whatsapp) — accept `FileFolder` instead of `FileStore`
- [ ] Update tool modules (image-generation, mermaid-png, send-file, sayFileResolve) — accept `FileFolder`
- [ ] Update commands (add.ts, doctor.ts) — use `FileFolder` directly
- [ ] Update plugin types (`engine/plugins/types.ts`, `engine/modules/tools/types.ts`, `engine/modules/images/types.ts`, `providers/types.ts`)
- [ ] Run tests — must pass before next task

### Task 6: Remove old FileStore and update all test files
- [ ] Delete `sources/files/store.ts` and `sources/files/store.spec.ts`
- [ ] Move types from `sources/files/types.ts` to `sources/engine/files/types.ts` (or keep and re-export)
- [ ] Update all test files that import `FileStore` to use `FileFolder` or `Files`
- [ ] Run tests — must pass before next task

### Task 7: Verify acceptance criteria
- [ ] Verify `Files` facade owns three `FileFolder` instances (downloads, desktop, tmp)
- [ ] Verify `tmp` directory is in UserHome and created by userHomeEnsure
- [ ] Run full test suite
- [ ] Run linter — all issues must be fixed

### Task 8: Update documentation
- [ ] Update relevant docs if any reference FileStore
- [ ] Add mermaid diagram for Files facade structure

## Technical Details

### FileFolder (replaces FileStore)
```typescript
export class FileFolder {
    readonly path: string;
    constructor(basePath: string);
    async saveBuffer(options: { name: string; mimeType: string; data: Buffer }): Promise<StoredFile>;
    async saveFromPath(options: { name: string; mimeType: string; path: string }): Promise<StoredFile>;
}
```

### Files facade
```typescript
export class Files {
    readonly downloads: FileFolder;
    readonly desktop: FileFolder;
    readonly tmp: FileFolder;
    constructor(homePath: string);
}
```

### UserHome (addition)
```
home/
  ├── desktop/
  ├── downloads/
  ├── documents/
  ├── developer/
  ├── knowledge/
  └── tmp/          ← new
```

## Post-Completion
- Verify no remaining imports of old `FileStore` path
- Check that plugin connector tests still pass with `FileFolder` type
