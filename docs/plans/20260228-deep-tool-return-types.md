# Remove shallow-object limitation from tool return schemas

## Overview
- Remove the "single-depth object" restriction in `toolResultSchemaValidate()` so tool return schemas can have arbitrarily nested objects, arrays of any depth, and unions containing objects
- Update Python/Monty TypedDict stub generation (`montyResponseTypedDictLinesBuild.ts`) to emit proper TypedDict definitions for nested object properties (not just array items), so the Python VM gets accurate type stubs for deeply nested return schemas
- Replace `Type.Any()` workarounds in `topologyToolBuild.ts` and `secretAddToolBuild.ts` with proper typed schemas
- Keep guardrails that still make sense: root must be an object, `additionalProperties: true` stays rejected
- After this change, tools can declare precise nested schemas instead of falling back to `Type.Any()` for anything beyond flat objects

## Context (from discovery)
- **Core file**: `packages/daycare/sources/engine/modules/toolResolver.ts` — `toolResultSchemaValidate()` (lines 152-178) enforces the shallow constraint
- **Type definitions**: `packages/daycare/sources/engine/modules/tools/types.ts` — `ToolResultShallowObject`, `ToolResultValue` (already supports recursive nesting at the type level)
- **Tests**: `packages/daycare/sources/engine/modules/toolResolver.spec.ts` — tests for schema acceptance/rejection
- **Python stub generation**:
  - `montyResponseTypedDictLinesBuild.ts` — generates Python TypedDict class definitions from return schemas; currently only handles arrays of objects (via `arrayObjectItemSchemaResolve`), nested object properties fall through to `montyPythonTypeFromSchema()` which returns `dict[str, Any]`
  - `montyPythonTypeFromSchema.ts` — maps JSON schema types to Python type hints; `type: "object"` → `dict[str, Any]` (correct fallback for truly dynamic objects)
  - `montyPreambleBuild.ts` — orchestrates stub generation, attaches TypedDict definitions before function stubs
- **Workaround sites**:
  - `topologyToolBuild.ts` lines 146-175: 5 fields use `Type.Any()` because their schemas have nested objects/arrays (`tasks`, `channels`, `secrets`, `subusers`, `friends`)
  - `secretAddToolBuild.ts` line 27: `variableNames` uses `Type.Any()` because it's `string[]` (array of primitives, not array of objects)
- **Legitimate `Type.Any()` uses** (should NOT be changed):
  - `plugins/shell/tool.ts:169` — `read_json` returns arbitrary JSON content
  - `rlmJsonParseTool.ts:16` — JSON parse returns unknown data
  - `rlmJsonStringifyTool.ts:9` — JSON stringify accepts unknown data (parameter)
- **Downstream consumers**: `rlmConvert.ts` already handles recursive structures via `montyValueConvert()`, no changes needed there

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility

## Testing Strategy
- **Unit tests**: required for every task (see Development Approach above)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope
- Keep plan in sync with actual work done
- ⚠️ `yarn test` currently has an unrelated flaky failure in `sources/engine/agents/agentSystemDurableInbox.spec.ts` (`ENOTEMPTY` while removing temp skill dir).
- ⚠️ `yarn lint` fails due pre-existing `packages/daycare-app` lint/format findings outside this change set.

## Implementation Steps

### Task 1: Make `toolResultSchemaValidate()` accept nested schemas
- [x] Rewrite `toolResultPropertySchemaIs()` in `toolResolver.ts` to recursively accept nested objects (not just primitives and arrays of shallow objects)
- [x] Allow object-type properties at any depth — validate that nested objects also use `additionalProperties: false` (or a valid schema)
- [x] Allow arrays of primitives (e.g., `Type.Array(Type.String())`) — currently rejected because items must be objects
- [x] Allow arrays of nested objects (e.g., array items can themselves contain objects/arrays)
- [x] Keep the root-must-be-object rule and `additionalProperties: true` rejection
- [x] Update error messages to reflect the new relaxed rules
- [x] Update existing tests in `toolResolver.spec.ts`: change the "keeps non-any return properties shallow" test to expect acceptance instead of rejection
- [x] Write new tests: nested object property accepted
- [x] Write new tests: array of primitives accepted
- [x] Write new tests: deeply nested structure (3+ levels) accepted
- [x] Write new tests: nested object with `additionalProperties: true` still rejected
- [x] Write new tests: array of objects with nested sub-objects accepted
- [x] Run tests — must pass before task 2

### Task 2: Update Python TypedDict stub generation for nested objects
- [x] In `montyResponseTypedDictLinesBuild.ts`, update `typedDictFieldsBuild()` to detect nested object properties (not just arrays of objects) and generate TypedDict definitions for them
- [x] When a property has `type: "object"` with known `properties`, generate a named TypedDict (e.g., `TopologyResponseTriggersItem`) and use it as the type hint instead of `dict[str, Any]`
- [x] Ensure recursion: nested objects within nested objects each get their own TypedDict definition
- [x] Arrays of primitives (e.g., `Type.Array(Type.String())`) should produce `list[str]` — verify `montyPythonTypeFromSchema` already handles this (it does via line 44)
- [x] Write tests in `montyResponseTypedDictLinesBuild.spec.ts`: nested object property generates TypedDict
- [x] Write tests: deeply nested object (object within object) generates multiple TypedDict definitions
- [x] Write tests: mixed schema with nested objects and arrays of nested objects
- [x] Write tests: array of primitives within an object property produces correct `list[str]` hint
- [x] Run tests — must pass before task 3

### Task 3: Replace `Type.Any()` workarounds in `topologyToolBuild.ts`
- [x] Replace `tasks: Type.Any()` with `Type.Array(_topologyTaskSchema)` (the proper schema already exists as `_topologyTaskSchema` on line 54)
- [x] Replace `channels: Type.Any()` with `Type.Array(_topologyChannelSchema)` (already exists on line 83)
- [x] Replace `secrets: Type.Any()` with a proper `Type.Array(topologySecretSchema)` schema with `variableNames: Type.Array(Type.String())`
- [x] Replace `subusers: Type.Any()` with `Type.Array(_topologySubuserSchema)` (already exists on line 113)
- [x] Replace `friends: Type.Any()` with `Type.Array(_topologyFriendSchema)` (already exists on line 135)
- [x] Remove the underscore prefix from schemas that are now used directly (`_topologyTaskSchema` → `topologyTaskSchema`, etc.)
- [x] Remove workaround comments (lines 149-163)
- [x] Run tests — must pass before task 4

### Task 4: Replace `Type.Any()` workaround in `secretAddToolBuild.ts`
- [x] Replace `variableNames: Type.Any()` with `Type.Array(Type.String())`
- [x] Remove the workaround comment on line 26
- [x] Run tests — must pass before task 5

### Task 5: Rename `ToolResultShallowObject` type
- [x] Rename `ToolResultShallowObject` to `ToolResultObject` in `tools/types.ts` since the shallow constraint no longer applies
- [x] Update all imports/references across the codebase (grep for `ToolResultShallowObject`)
- [x] Update the re-export in `sources/types.ts`
- [x] Run tests — must pass before task 6

### Task 6: Verify acceptance criteria
- [x] Verify all requirements from Overview are implemented
- [x] Verify edge cases are handled (deeply nested schemas, arrays of primitives, unions with objects)
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run typecheck (`yarn typecheck`)

### Task 7: [Final] Update documentation
- [x] Update `doc/PLUGINS.md` if it references the shallow-object constraint (no shallow-object references found; no update required)
- [x] Add brief note in the toolResolver about the supported schema shapes

## Technical Details

### Schema validation changes (Task 1)
The rewritten `toolResultPropertySchemaIs()` will accept:
- Primitives: `string`, `number`, `integer`, `boolean`, `null`
- `Type.Any()`
- Objects: `Type.Object(...)` with `additionalProperties: false` (or valid schema) — recurse into properties
- Arrays of primitives: `Type.Array(Type.String())`
- Arrays of objects: `Type.Array(Type.Object(...))` — recurse into item properties
- Unions: `anyOf`/`oneOf`/`allOf` where all variants pass validation

The function becomes recursive with no depth limit.

### Python TypedDict generation changes (Task 2)
Currently `typedDictFieldsBuild()` only generates TypedDict for array-of-object items. When a property is `type: "object"`, it falls through to `montyPythonTypeFromSchema()` → `dict[str, Any]`. The fix:
- Add an object detection branch in `typedDictFieldsBuild()` before the `montyPythonTypeFromSchema()` fallback
- When a property has `type: "object"` with `properties`, generate a named TypedDict and recurse into its fields
- This mirrors the existing array-item handling but for direct object properties

Example: `triggers: Type.Object({ cron: Type.Array(...), heartbeat: Type.Array(...) })` should produce:
```python
TopologyResponseTasksItemTriggers = TypedDict("TopologyResponseTasksItemTriggers", { "cron": list[...], "heartbeat": list[...] })
```

### Files changed
| File | Change |
|------|--------|
| `toolResolver.ts` | Rewrite `toolResultPropertySchemaIs()` + related helpers |
| `toolResolver.spec.ts` | Update and add schema validation tests |
| `montyResponseTypedDictLinesBuild.ts` | Handle nested object properties → TypedDict generation |
| `montyResponseTypedDictLinesBuild.spec.ts` | Add tests for nested object TypedDict generation |
| `topologyToolBuild.ts` | Replace 5× `Type.Any()` with proper schemas |
| `secretAddToolBuild.ts` | Replace 1× `Type.Any()` with `Type.Array(Type.String())` |
| `tools/types.ts` | Rename `ToolResultShallowObject` → `ToolResultObject` |
| `sources/types.ts` | Update re-export |
| All files importing `ToolResultShallowObject` | Update import name |

## Post-Completion

**Manual verification:**
- Run a local env (`yarn env`) and trigger the `topology` tool to verify nested data comes through correctly
- Verify the `secret_add` tool returns proper `variableNames` array
