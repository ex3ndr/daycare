# Fragment Read & List Tools

## Overview
Add two read-only LLM tools so agents can inspect existing fragments:
- `fragment_read` — read a single fragment by id (returns full spec, title, version, etc.)
- `fragment_list` — list all active non-archived fragments for the current user (returns summary without full spec)

These complement the existing `fragment_create`, `fragment_update`, and `fragment_archive` tools.

## Context
- Existing tools: `packages/daycare/sources/engine/modules/tools/fragmentCreateToolBuild.ts` (pattern to follow)
- Repository: `packages/daycare/sources/storage/fragmentsRepository.ts` — already has `findById`, `findAll`, `findAnyById`
- Registration: `packages/daycare/sources/engine/engine.ts` — `this.modules.tools.register("core", ...)`

## Development Approach
- **Testing approach**: Code first, then tests
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Progress Tracking
- Mark completed items with `[x]` immediately when done

## Implementation Steps

### Task 1: Create fragment_read tool
- [x] Create `packages/daycare/sources/engine/modules/tools/fragmentReadToolBuild.ts`
  - Parameters: `fragmentId` (string, required)
  - Returns: `{ summary: string, fragment: { id, kitVersion, title, description, spec, archived, version, createdAt, updatedAt } | null }`
  - Execute: calls `storage.fragments.findAnyById(ctx, fragmentId)` (includes archived for direct reference)
  - `toLLMText`: format as readable summary with JSON spec
- [x] Register in `engine.ts`: `this.modules.tools.register("core", fragmentReadToolBuild())`
- [x] Write tests for execute (found, not found)
- [x] Run tests — must pass before next task

### Task 2: Create fragment_list tool
- [x] Create `packages/daycare/sources/engine/modules/tools/fragmentListToolBuild.ts`
  - Parameters: none (empty object)
  - Returns: `{ summary: string, fragments: Array<{ id, kitVersion, title, description, version, createdAt, updatedAt }> }`
  - Execute: calls `storage.fragments.findAll(ctx)` — returns active non-archived only, omits full spec for brevity
  - `toLLMText`: format as list with id, title, kitVersion, version
- [x] Register in `engine.ts`
- [x] Write tests for execute (empty list, with fragments)
- [x] Run tests — must pass before next task

### Task 3: Verify and lint
- [x] Run full test suite
- [x] Run linter — all issues must be fixed

## Technical Details

### fragment_read result shape
```typescript
{
    summary: "Fragment user-profile-card (version 2, kitVersion 1).",
    fragment: {
        id: "abc123",
        kitVersion: "1",
        title: "User Profile Card",
        description: "...",
        spec: { type: "Column", ... },
        archived: false,
        version: 2,
        createdAt: 1709553600000,
        updatedAt: 1709640000000
    }
}
```

### fragment_list result shape
```typescript
{
    summary: "Found 3 fragments:\n- abc123: User Profile Card (v2, kit 1)\n- ...",
    fragments: [
        { id: "abc123", kitVersion: "1", title: "User Profile Card", description: "...", version: 2, createdAt: ..., updatedAt: ... },
        ...
    ]
}
```
