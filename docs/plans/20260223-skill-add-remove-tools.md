# Skill Add/Remove Tools

## Overview
Add `skill_add` and `skill_remove` tools that let agents install and uninstall personal skills at runtime. `skill_add` copies a skill folder from a local path into the user's personal skills directory, replacing any existing skill with the same name. `skill_remove` deletes a personal skill by name.

These tools enable agents to self-manage their skill catalog without manual filesystem operations.

## Context (from discovery)
- Personal skills stored at: `users/<userId>/skills/personal/<skill-name>/skill.md`
- `UserHome.skillsPersonal` resolves this path
- `ToolExecutionContext` has `skillsActiveRoot` but no `skillsPersonalRoot` — needs adding
- Tools registered as `"core"` in `engine.ts` via `*ToolBuild()` pattern
- Skill activation sync runs before each inference — new/removed skills take effect immediately
- Skill validation: `skillResolve()` parses frontmatter, requires `name` field
- `SKILL_FILENAME = "skill.md"` (lowercase)
- Tool naming convention: `friendAddToolBuild`, `friendRemoveToolBuild`
- Visibility: `visibleByDefault` filter uses `context.descriptor.type === "user"`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Implementation Steps

### Task 1: Add `skillsPersonalRoot` to `ToolExecutionContext`
- [x] Add `skillsPersonalRoot?: string` field to `ToolExecutionContext` in `sources/engine/modules/tools/types.ts`
- [x] Thread `skillsPersonalRoot` from `this.userHome.skillsPersonal` in `agent.ts` where `skillsActiveRoot` is set (~line 580)
- [x] Thread through `agentLoopRun.ts` options and tool execution context building (~lines 487, 625)
- [x] Add `skillsPersonalRoot` to `AgentLoopRunOptions` type in `agentLoopRun.ts`
- [x] Verify build passes (`yarn typecheck`)

### Task 2: Implement `skillAddToolBuild`
- [x] Create `sources/engine/modules/tools/skillAddToolBuild.ts`
- [x] Schema: `{ path: string }` — path to skill folder (must contain `skill.md`)
- [x] Tool name: `skill_add`
- [x] Validate source folder exists and contains readable `skill.md` with valid `name` frontmatter
- [x] Resolve target: `<skillsPersonalRoot>/<skill-name>/`
- [x] Copy: remove existing target dir if present, then `fs.cp(source, target, { recursive: true })`
- [x] Result schema: `{ summary: string, skillName: string, status: string }`
- [x] Visibility: `context.descriptor.type === "user"` only
- [x] Path traversal protection: reject skill names with `/`, `\`, or dot-prefixed
- [x] Write tests for success case (copy to personal dir, verify files)
- [x] Write tests for error cases (missing skill.md, missing name frontmatter, missing personal root, path traversal)
- [x] Run tests — must pass before next task

### Task 3: Implement `skillRemoveToolBuild`
- [x] Create `sources/engine/modules/tools/skillRemoveToolBuild.ts`
- [x] Schema: `{ name: string }` — skill name to remove
- [x] Tool name: `skill_remove`
- [x] Scan personal skills root to find folder containing `skill.md` with matching `name` (case-insensitive)
- [x] Remove the matched folder with `fs.rm(dir, { recursive: true, force: true })`
- [x] Error if no personal skill matches the given name
- [x] Result schema: `{ summary: string, skillName: string, status: string }`
- [x] Visibility: `context.descriptor.type === "user"` only
- [x] Write tests for success case (skill removed from personal dir)
- [x] Write tests for error cases (skill not found, missing personal root)
- [x] Run tests — must pass before next task

### Task 4: Register tools in engine
- [x] Import `skillAddToolBuild` and `skillRemoveToolBuild` in `engine.ts`
- [x] Register both tools next to `skillToolBuild()` registration (~line 373)
- [x] Verify build passes (`yarn typecheck`)
- [x] Run full test suite

### Task 5: Verify acceptance criteria
- [x] Verify all requirements from Overview are implemented
- [x] Verify edge cases are handled (path traversal, empty names, non-existent paths)
- [x] Run full test suite (unit tests)
- [x] Run linter (`yarn lint`) — all issues must be fixed

## Technical Details

### `skill_add` flow
1. Receive `path` arg (folder containing `skill.md`)
2. Resolve `skill.md` path: `path.join(inputPath, SKILL_FILENAME)`
3. Parse frontmatter with `gray-matter`, extract `name`
4. Validate `name` is non-empty string
5. Validate name is safe (no path separators, not dot-prefixed)
6. Target dir: `path.join(skillsPersonalRoot, name)`
7. `fs.rm(targetDir, { recursive: true, force: true })` (idempotent replace)
8. `fs.cp(inputPath, targetDir, { recursive: true })`
9. Return success with skill name

### `skill_remove` flow
1. Receive `name` arg
2. Scan `skillsPersonalRoot` entries
3. For each subdirectory, read `skill.md`, parse frontmatter `name`
4. If match found (case-insensitive), `fs.rm(matchedDir, { recursive: true, force: true })`
5. If no match, throw error
6. Return success with removed skill name

### Result schema (shared pattern)
```typescript
Type.Object({
    summary: Type.String(),
    skillName: Type.String(),
    status: Type.String()   // "installed" | "replaced" | "removed"
}, { additionalProperties: false })
```

## Post-Completion
- Verify skills appear/disappear in agent system prompt after add/remove
- Test in Docker sandbox environment (skills sync to active dir)
