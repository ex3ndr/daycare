# Add Filesystem Tools (write_output, grep, find, ls)

## Overview
Add four new tools to the shell plugin:
1. **`write_output`** — Writes `.md` files to `/home/outputs/` with unique name generation (appends ` (N)` on collision)
2. **`grep`** — Content search using system `rg` (ripgrep) via `sandbox.exec()`
3. **`find`** — File search using system `fd` via `sandbox.exec()`
4. **`ls`** — Directory listing using system `ls` via `sandbox.exec()`

These extend the existing shell plugin at `packages/daycare/sources/plugins/shell/`.

## References
- **grep tool**: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/grep.ts
- **find tool**: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/find.ts
- **ls tool**: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/tools/ls.ts
- **ripgrep bundling reference** (not used, system binary instead): https://github.com/slopus/happy/tree/main/packages/happy-cli/src/modules/ripgrep

## Context
- Shell plugin already registers `read`, `write`, `edit`, `exec`, and process tools
- Tools follow `ToolDefinition` pattern with `tool`, `returns`, `execute`
- File tools use `context.sandbox` for read/write and `context.sandbox.exec()` for commands
- `/home/outputs/` is already a known output path (referenced in `TOOLS_PYTHON.md`)
- `rg`, `fd`, and `ls` are assumed available in the sandbox environment (no vendoring needed)
- Tool builder functions follow prefix naming: `buildXxxTool()`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change

## Testing Strategy
- **Unit tests**: required for every task
- Pure functions (name dedup logic, output formatting) get direct unit tests
- Tool builders get integration-style tests following existing `tool.spec.ts` patterns

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `write_output` tool
- [x] Create `packages/daycare/sources/plugins/shell/writeOutputTool.ts`
- [x] Define schema: `name` (required string, no `.md` extension) + `content` (required string)
- [x] Implement unique name logic: check if `/home/outputs/{name}.md` exists, if so try `{name} (1).md`, `{name} (2).md`, etc.
- [x] Use `context.sandbox.write()` to write the file, creating `/home/outputs/` dir if needed
- [x] Return the final file path in the tool result
- [x] Register in `plugin.ts` (`load`/`unload`)
- [x] Write tests for name dedup logic (no collision, single collision, multiple collisions)
- [x] Write tests for tool builder (schema validation, successful write)
- [x] Run tests — must pass before next task

### Task 2: Add `grep` tool
- [x] Create `packages/daycare/sources/plugins/shell/grepTool.ts`
- [x] Define schema: `pattern` (required), `path` (optional, defaults to working dir), `glob` (optional file filter), `ignoreCase` (optional bool), `context` (optional number for context lines), `limit` (optional, default 100 matches)
- [x] Implement using `context.sandbox.exec()` to run `rg` with appropriate flags
- [x] Parse ripgrep output, format as file:line:content results
- [x] Apply truncation limits (max bytes, max matches)
- [x] Register in `plugin.ts`
- [x] Write tests for output formatting/parsing logic
- [x] Write tests for tool builder (schema, basic execution)
- [x] Run tests — must pass before next task

### Task 3: Add `find` tool
- [x] Create `packages/daycare/sources/plugins/shell/findTool.ts`
- [x] Define schema: `pattern` (required glob), `path` (optional, defaults to working dir), `limit` (optional, default 1000)
- [x] Implement using `context.sandbox.exec()` to run `fd --glob --color=never --hidden`
- [x] Respect `.gitignore`, exclude `node_modules` and `.git`
- [x] Format output as relative paths, apply truncation
- [x] Register in `plugin.ts`
- [x] Write tests for output formatting
- [x] Write tests for tool builder
- [x] Run tests — must pass before next task

### Task 4: Add `ls` tool
- [x] Create `packages/daycare/sources/plugins/shell/lsTool.ts`
- [x] Define schema: `path` (optional, defaults to working dir), `limit` (optional, default 500)
- [x] Implement using `context.sandbox.exec()` with `ls -1apL` (one per line, show dirs with `/`, show hidden, dereference symlinks)
- [x] Sort output alphabetically, apply entry limit
- [x] Register in `plugin.ts`
- [x] Write tests for output formatting
- [x] Write tests for tool builder
- [x] Run tests — must pass before next task

### Task 5: Update RLM Python tool documentation
- [x] Update `packages/daycare/sources/prompts/TOOLS_PYTHON.md` to mention the new tools if appropriate
- [x] Run tests — must pass before next task

### Task 6: Verify acceptance criteria
- [x] Verify all 4 tools are registered and functional
- [x] Verify write_output unique name generation works correctly
- [x] Verify grep/find/ls use system binaries via sandbox.exec()
- [x] Run full test suite (`yarn test`)
- [x] Run linter (`yarn lint`)
- [x] Run type-check (`yarn typecheck`)

### Task 7: [Final] Update documentation
- [x] Update shell plugin `README.md` with new tool descriptions
- [x] Update `doc/` if new patterns discovered

## Technical Details

### write_output schema
```typescript
Type.Object({
    name: Type.String({ minLength: 1, description: "File name without .md extension" }),
    content: Type.String({ description: "Markdown content to write" })
}, { additionalProperties: false })
```

Unique name algorithm:
```
base = "/home/outputs/{name}.md"
if not exists → write base
else try "/home/outputs/{name} (1).md", "{name} (2).md", ... up to (99)
return final path
```

### grep schema
```typescript
Type.Object({
    pattern: Type.String({ minLength: 1, description: "Regex pattern to search for" }),
    path: Type.Optional(Type.String({ description: "Directory or file to search (default: working dir)" })),
    glob: Type.Optional(Type.String({ description: "Glob filter for files, e.g. '*.ts'" })),
    ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search" })),
    context: Type.Optional(Type.Number({ minimum: 0, maximum: 10, description: "Lines of context around matches" })),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 500, description: "Max results (default: 100)" }))
}, { additionalProperties: false })
```

Ripgrep command: `rg --max-count={limit} [-i] [-g {glob}] [-C {context}] {pattern} {path}`

### find schema
```typescript
Type.Object({
    pattern: Type.String({ minLength: 1, description: "Glob pattern, e.g. '*.ts'" }),
    path: Type.Optional(Type.String({ description: "Directory to search (default: working dir)" })),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 5000, description: "Max results (default: 1000)" }))
}, { additionalProperties: false })
```

fd command: `fd --glob --color=never --hidden --max-results={limit} {pattern} {path}`

### ls schema
```typescript
Type.Object({
    path: Type.Optional(Type.String({ description: "Directory to list (default: working dir)" })),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 2000, description: "Max entries (default: 500)" }))
}, { additionalProperties: false })
```

ls command: `ls -1apL {path}` piped through head for limit

## Post-Completion

**Manual verification:**
- Test grep/find/ls with real file patterns in a running agent
- Verify write_output creates files accessible to downstream tools
- Verify `rg`, `fd`, `ls` are present in Docker sandbox image
