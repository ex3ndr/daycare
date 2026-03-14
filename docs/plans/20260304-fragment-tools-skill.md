# Fragment Tools & Create-Fragment Skill

## Overview
Add LLM tools for fragment CRUD and a `create-fragment` skill that guides the LLM to produce valid json-render specs. Also add an export script that builds the final SKILL.md by concatenating a template header with the catalog's generated prompt.

**Deliverables:**
1. Three LLM tools: `fragment_create`, `fragment_update`, `fragment_archive` — registered as core tools, visible to all agents
2. A skill template (`packages/daycare-app/sources/prompts/fragments/SKILL_TEMPLATE.md`) with the static header (frontmatter + workflow + tool docs + design guidelines)
3. An export script (`packages/daycare-app/scripts/exportFragmentSkill.ts`) that concatenates the template with `widgetsCatalog.prompt()` and writes the final `SKILL.md` to `packages/daycare/sources/skills/software-development/create-fragment/SKILL.md`

**Key behaviors:**
- `fragment_create` accepts `title`, `kitVersion`, `spec` (json-render spec), optional `description`; returns `{ fragmentId, version }`
- `fragment_update` accepts `fragmentId` + partial fields; returns updated `{ fragmentId, version }`
- `fragment_archive` accepts `fragmentId`; archives the fragment
- Export script: `npx tsx packages/daycare-app/scripts/exportFragmentSkill.ts` — reads template header, appends `widgetsCatalog.prompt()`, overwrites target SKILL.md

## Context
- Fragment repository: `packages/daycare/sources/storage/fragmentsRepository.ts` (already implemented)
- Tool pattern: `packages/daycare/sources/engine/modules/tools/documentWriteToolBuild.ts` — TypeBox schema, `ToolDefinition`, `ToolResultContract`
- Tool registration: `packages/daycare/sources/engine/engine.ts` line ~708 — `this.modules.tools.register("core", ...)`
- Skill pattern: `packages/daycare/sources/skills/autonomous-ai-agents/tasks-creator/SKILL.md` — YAML frontmatter + markdown body
- Widget catalog: `packages/daycare-app/sources/widgets/widgets.ts` — `widgetsCatalog` with `jsonSchema()` and `prompt()` methods
- Skills directory: `packages/daycare/sources/skills/`

## Development Approach
- **Testing approach**: Code first, then tests
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Testing Strategy
- **Unit tests**: tool execute functions tested with mocked storage/context
- Export script tested manually (stdout output)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Create fragment_create tool
- [ ] Create `packages/daycare/sources/engine/modules/tools/fragmentCreateToolBuild.ts`
  - Parameters: `title` (string, required), `kitVersion` (string, required), `spec` (object, required), `description` (string, optional)
  - Returns: `{ summary: string, fragmentId: string, version: number }`
  - Execute: generates id via `createId()`, calls `storage.fragments.create(ctx, ...)`
- [ ] Register in `engine.ts`: `this.modules.tools.register("core", fragmentCreateToolBuild())`
- [ ] Write tests for execute (success case, missing required fields)
- [ ] Run tests — must pass before next task

### Task 2: Create fragment_update tool
- [ ] Create `packages/daycare/sources/engine/modules/tools/fragmentUpdateToolBuild.ts`
  - Parameters: `fragmentId` (string, required), `title` (string, optional), `description` (string, optional), `spec` (object, optional), `kitVersion` (string, optional)
  - Returns: `{ summary: string, fragmentId: string, version: number }`
  - Execute: calls `storage.fragments.update(ctx, fragmentId, ...)`, returns new version
- [ ] Register in `engine.ts`
- [ ] Write tests for execute (success case, not found error, no changes error)
- [ ] Run tests — must pass before next task

### Task 3: Create fragment_archive tool
- [ ] Create `packages/daycare/sources/engine/modules/tools/fragmentArchiveToolBuild.ts`
  - Parameters: `fragmentId` (string, required)
  - Returns: `{ summary: string, fragmentId: string }`
  - Execute: calls `storage.fragments.archive(ctx, fragmentId)`
- [ ] Register in `engine.ts`
- [ ] Write tests for execute (success case, not found error)
- [ ] Run tests — must pass before next task

### Task 4: Create skill template header
- [ ] Create `packages/daycare-app/sources/prompts/fragments/SKILL_TEMPLATE.md` with the static skill content (frontmatter + body before catalog prompt):

```markdown
---
name: create-fragment
description: Create or update UI fragments using the json-render widget catalog. Use when users ask to build a widget, card, panel, modal, or any reusable UI component.
sandbox: true
---

# Fragment Creation

Build UI fragments as json-render specs. Fragments are self-contained, versioned UI definitions
that can be embedded anywhere in the app.

## Core Rules

1. Every fragment must have a `title`, `kitVersion`, and valid `spec`.
2. The `spec` is a json-render component tree using the widget catalog below.
3. Use semantic tokens only (colorRole, spacingScale, surfaceLevel) — never raw hex values or pixel sizes.
4. Keep specs focused — one clear UI purpose per fragment.
5. Always set `kitVersion` to "1" (current catalog version).

## Workflow

1. Understand what UI the user wants.
2. Design the component tree using available widgets.
3. Call `fragment_create` with the spec.
4. If updating an existing fragment, call `fragment_update` with the `fragmentId`.

## Available Tools

- `fragment_create` — create a new fragment with `title`, `kitVersion`, `spec`, and optional `description`
- `fragment_update` — update an existing fragment by `fragmentId` (partial fields: title, description, spec, kitVersion)
- `fragment_archive` — archive a fragment by `fragmentId` (hides from listings, still renderable by direct reference)

## Design Guidelines

1. **Layout first**: start with `Column` or `Row` as root, then nest content.
2. **Consistent spacing**: use the same `gap` scale within a container.
3. **Surface hierarchy**: use `surfaceLevel` to create visual depth (lowest → highest).
4. **Readable text**: pair `textSize` with appropriate `textWeight`.
5. **Accessible controls**: always set `label` on buttons, `title` on list items.
6. **Sections**: use `ScrollArea` > `Section` pattern for grouped content with titles.

## Completion Checklist

Before finishing:

1. Spec uses only components from the widget catalog.
2. All props use semantic tokens (no raw values).
3. `kitVersion` is set to "1".
4. `fragment_create` or `fragment_update` was called successfully.
5. Fragment has a clear, descriptive `title`.

## Widget Catalog Reference

```

- [ ] Run lint on template — must pass before next task

### Task 5: Create export script and generate SKILL.md
- [ ] Create `packages/daycare-app/scripts/exportFragmentSkill.ts`:
  - Reads `SKILL_TEMPLATE.md` template from the same directory
  - Imports `widgetsCatalog` from `../sources/widgets/widgets.ts`
  - Calls `widgetsCatalog.prompt()` to get the catalog prompt
  - Concatenates: `header + "\n" + catalogPrompt`
  - Writes result to `packages/daycare/sources/skills/software-development/create-fragment/SKILL.md` (creates directory if needed)
- [ ] Verify script runs: `npx tsx packages/daycare-app/scripts/exportFragmentSkill.ts`
- [ ] Verify generated SKILL.md has valid YAML frontmatter (parseable by gray-matter)
- [ ] Verify generated SKILL.md contains widget catalog component documentation
- [ ] Run lint — must pass before next task

### Task 6: Verify acceptance criteria
- [ ] Verify `fragment_create` tool creates a fragment and returns id + version
- [ ] Verify `fragment_update` tool updates a fragment and increments version
- [ ] Verify `fragment_archive` tool archives a fragment
- [ ] Verify export script generates SKILL.md with valid frontmatter + catalog prompt
- [ ] Run full test suite
- [ ] Run linter — all issues must be fixed

### Task 7: Update documentation
- [ ] Update `/doc/fragments.md` to document the three tools and the create-fragment skill

## Technical Details

### Tool Result Pattern
All three tools follow the standard `ToolResultContract` + `toolResultBuild` pattern:
```typescript
const toolMessage: ToolResultMessage = {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text: summary }],
    isError: false,
    timestamp: Date.now()
};
return { toolMessage, typedResult };
```

### Storage Access Pattern
Tools access the fragments repository via `toolContext.storage ?? toolContext.agentSystem.storage`:
```typescript
const storage = toolContext.storage ?? toolContext.agentSystem.storage;
await storage.fragments.create(toolContext.ctx, { ... });
```

### Export Script Flow
```
┌──────────────────────────────────────────┐
│  SKILL_TEMPLATE.md            │
│  (frontmatter + workflow + tools + etc.) │
└────────────────┬─────────────────────────┘
                 │ read
                 ▼
┌──────────────────────────────────────────┐
│  exportFragmentSkill.ts                  │
│  header + widgetsCatalog.prompt()        │
└────────────────┬─────────────────────────┘
                 │ write
                 ▼
┌──────────────────────────────────────────┐
│  skills/create-fragment/SKILL.md         │
│  (complete skill: header + catalog docs) │
└──────────────────────────────────────────┘
```

## Post-Completion
**Follow-up work:**
- App-side rendering: load fragments from API and render via `JSONUIProvider`/`Renderer`
- Re-run export script whenever the widget catalog changes to keep skill in sync
