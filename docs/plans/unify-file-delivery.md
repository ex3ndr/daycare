# Unify File Delivery: Remove Auto-Attach, Drop `files` from Tool Results, Add `<file>` Tags

## Overview
- Remove `files: FileReference[]` from `ToolExecutionResult` entirely — tools return file paths as text
- Remove auto-attach logic from `agentLoopRun.ts` (the `generatedFiles` accumulation + post-loop send)
- `generate_image` and `generate_mermaid_png` already include paths in text results — just stop populating `files`
- In normal mode: model uses `send_file` tool to deliver files explicitly
- In say mode: model uses `<file>` XML tags (siblings to `<say>`) to attach files with optional `mode` attribute
- RLM mode: no change (already doesn't auto-attach)

## Context
- **`ToolExecutionResult` type**: `types.ts:38-41` has `{ toolMessage, files: FileReference[] }`
- **Only 2 tools return non-empty `files`**: `generate_image` (returns provider files) and `generate_mermaid_png` (returns stored PNG)
- **All other tools** (~40+) return `files: []` — dead field for them
- **Auto-attach logic**: `agentLoopRun.ts:466-469` collects files, lines 601-611 send via connector
- **`toolResultFormatVerbose.ts`**: displays file count from `result.files.length`
- **`toolResolver.ts:69`**: logs `fileCount=${result.files.length}`
- **Say mode**: `agentLoopRun.ts:256-287` extracts `<say>` blocks, sends individually
- **System prompt**: `SYSTEM.md:269-271` says "Files attached automatically"
- **Tag extraction**: `tagExtract.ts` has `tagExtractAll` — supports attributes in open tags but doesn't extract attribute values
- **`send_file` tool**: already sends files directly via connector, returns `files: []`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Remove `files` field from `ToolExecutionResult` and all tool returns
- [ ] Remove `files: FileReference[]` from `ToolExecutionResult` in `engine/modules/tools/types.ts`
- [ ] Remove `FileReference` import from `types.ts` if no longer needed
- [ ] Update `generate_image` (`image-generation.ts`): remove `files: result.files` from return, keep existing text content (already has `Image file: ${outputPath}`)
- [ ] Update `generate_mermaid_png` (`mermaid-png.ts`): remove `files: [...]` from return, add file path to text content: `Generated Mermaid PNG: ${stored.path}`
- [ ] Remove `files: []` from all tool returns across the codebase (~40 tools):
  - Engine tools: `send-file.ts`, `channelCreateTool.ts`, `channelSendTool.ts`, `channelHistoryTool.ts`, `channelMemberTool.ts`, `heartbeat.ts`, `permissions.ts`, `signal.ts`, `signalSubscribeToolBuild.ts`, `signalUnsubscribeToolBuild.ts`, `signalEventsCsvToolBuild.ts`, `background.ts`, `cron.ts`, `reaction.ts`, `sessionHistoryToolBuild.ts`, `topologyToolBuild.ts`, `permanentAgentToolBuild.ts`, `skillToolBuild.ts`, `exposeCreateToolBuild.ts`, `exposeListToolBuild.ts`, `exposeUpdateToolBuild.ts`, `exposeRemoveToolBuild.ts`, `sendUserMessageTool.ts`
  - Plugin tools: `shell/tool.ts` (6 returns), `shell/processTools.ts`, `monty-python/tool.ts`, `memory/tool.ts`, `web-fetch/plugin.ts`, `firecrawl/plugin.ts`, `database/plugin.ts`, `anthropic-search/plugin.ts`, `anthropic-fetch/plugin.ts`, `openai-search/plugin.ts`, `gemini-search/plugin.ts`, `perplexity-search/plugin.ts`, `brave-search/plugin.ts`, `exa-ai/plugin.ts`
  - Infrastructure: `toolResolver.ts` (error returns), `agentHistoryPendingToolResultsBuild.ts`, `rlmToolResultBuild.ts`, `appToolExecutorBuild.ts`
- [ ] Update `toolResultFormatVerbose.ts`: remove `result.files.length` file info display
- [ ] Update `toolResolver.ts:69`: remove `fileCount=` from log
- [ ] Update `FileReference` re-export in `sources/types.ts` if orphaned
- [ ] Update all test files that construct `ToolExecutionResult` objects to remove `files` field:
  - `agentLoopRun.spec.ts`, `toolResultFormatVerbose.spec.ts`, `toolResultTruncate.spec.ts`, `contextEstimateTokens.spec.ts`, `toolResolver.spec.ts`, `rlmConvert.spec.ts`, `rlmExecute.spec.ts`, `rlmRestore.spec.ts`, `rlmTool.spec.ts`, `appToolExecutorBuild.spec.ts`, `appExecute.spec.ts`
- [ ] Run `yarn typecheck` — must pass
- [ ] Run `yarn test` — must pass before next task

### Task 2: Remove auto-attach logic from `agentLoopRun.ts`
- [ ] Remove `generatedFiles` array declaration (line ~111)
- [ ] Remove file accumulation after tool execution (lines ~466-469)
- [ ] Remove `shouldSendFiles` variable and file-related logic in post-loop send (lines ~602, 611)
- [ ] Remove the `generatedFiles.length === 0` check in the early-return guard (line ~576)
- [ ] Simplify post-loop send to only handle text
- [ ] Remove `FileReference` import if no longer used
- [ ] Update tests in `agentLoopRun.spec.ts`: remove/update tests that assert auto-attach file delivery
- [ ] Run tests — must pass before next task

### Task 3: Update system prompt for explicit file delivery
- [ ] Remove auto-attach paragraph from `SYSTEM.md` (lines 269-271)
- [ ] Replace with: "Files from tool calls are NOT attached automatically. Always use `send_file` to deliver files to the user."
- [ ] In say-mode section (line ~260), add `<file>` tag instructions:
  ```
  To send files, use `<file>` tags as siblings to `<say>`:
  `<file>/path/to/file.jpg</file>`
  Force send mode with: `<file mode="doc">`, `<file mode="photo">`, `<file mode="video">`. Default auto-detects from file type.
  ```
- [ ] Verify prompt renders correctly with `features.say` on/off
- [ ] Run tests — must pass before next task

### Task 4: Add `tagExtractAllWithAttrs` utility
- [ ] Create `packages/daycare/sources/util/tagExtractAllWithAttrs.ts`
- [ ] Function signature: `tagExtractAllWithAttrs(text: string, tag: string): { content: string, attrs: Record<string, string> }[]`
- [ ] Parse attributes from opening tag (e.g., `<file mode="doc">` → `{ mode: "doc" }`)
- [ ] Export `escapeRegExp` from `tagExtract.ts` for reuse
- [ ] Write tests in `tagExtractAllWithAttrs.spec.ts`: basic extraction, multiple tags, attributes with quotes, no attributes, no matches, mixed content
- [ ] Run tests — must pass before next task

### Task 5: Create `sayFileExtract` to parse `<file>` tags from model response
- [ ] Create `packages/daycare/sources/engine/modules/say/sayFileExtract.ts`
- [ ] Use `tagExtractAllWithAttrs` to extract `<file>` tags
- [ ] Return `{ path: string, mode: ConnectorFileDisposition }[]`
- [ ] Map mode values: `"doc"` → `"document"`, `"photo"` → `"photo"`, `"video"` → `"video"`, absent/invalid → `"auto"`
- [ ] Content of tag = file path (trimmed)
- [ ] Write tests in `sayFileExtract.spec.ts`
- [ ] Run tests — must pass before next task

### Task 6: Create `sayFileResolve` to resolve file paths to `ConnectorFile[]`
- [ ] Create `packages/daycare/sources/engine/modules/say/sayFileResolve.ts`
- [ ] Resolve each path: look up in `FileStore` or resolve securely from filesystem
- [ ] Return `ConnectorFile[]` with `sendAs` from parsed mode
- [ ] Log warning and skip unresolvable files (don't fail the response)
- [ ] Write tests in `sayFileResolve.spec.ts`
- [ ] Run tests — must pass before next task

### Task 7: Integrate `<file>` tag processing into say mode in `agentLoopRun.ts`
- [ ] In say-mode branch, after extracting `<say>` blocks, extract `<file>` tags from full response text (before suppression)
- [ ] Resolve via `sayFileResolve`
- [ ] Attach resolved files to the last `<say>` block's `sendMessage` call
- [ ] If no `<say>` blocks but `<file>` tags exist, send files with `text: null`
- [ ] Write/update tests in `agentLoopRun.spec.ts` for say + file tag scenarios
- [ ] Run tests — must pass before next task

### Task 8: Verify acceptance criteria
- [ ] Normal mode: files NOT auto-attached from tool results
- [ ] Normal mode: `send_file` tool works
- [ ] Say mode: `<file>` tags resolve and deliver files
- [ ] Say mode: `<file mode="doc">` forces document disposition
- [ ] RLM mode: unaffected
- [ ] Run `yarn test` — full suite passes
- [ ] Run `yarn typecheck` — passes

### Task 9: Update documentation
- [ ] Add `doc/internals/file-delivery.md` explaining unified behavior (normal: `send_file`, say: `<file>` tags, RLM: python `send_file`)
- [ ] Remove or update `doc/internals/image-generated-file-dedup.md` (references auto-attach)

## Technical Details

### `ToolExecutionResult` before/after
```typescript
// BEFORE
export type ToolExecutionResult = {
  toolMessage: ToolResultMessage;
  files: FileReference[];
};

// AFTER
export type ToolExecutionResult = {
  toolMessage: ToolResultMessage;
};
```

### Tool text result examples (after change)
```
generate_image:   "Generated 1 image(s) with openai. Saved under /workspace/files.\nImage file: /workspace/files/2025-01-15T10-00-00-000Z.png (image/png)"
generate_mermaid: "Generated Mermaid PNG: /workspace/files/mermaid-1705312800000.png"
```

### `<file>` tag syntax (say mode only)
```
<file>/path/to/file.jpg</file>
<file mode="doc">/path/to/report.pdf</file>
<file mode="photo">/path/to/image.png</file>
<file mode="video">/path/to/clip.mp4</file>
```

### Mode mapping
| Tag attribute | `ConnectorFileDisposition` |
|---|---|
| (none) | `"auto"` |
| `mode="doc"` | `"document"` |
| `mode="photo"` | `"photo"` |
| `mode="video"` | `"video"` |

### File resolution in say mode
1. Look up path in `FileStore` (matches stored files by path)
2. Secure filesystem resolution (same as `send_file` tool)
3. Log warning + skip on failure

### Say mode message flow
```
Model: "<say>Here is the report</say><file mode="doc">/workspace/files/report.pdf</file>"
         ↓
  Extract <say> → ["Here is the report"]
  Extract <file> → [{ path: ".../report.pdf", mode: "document" }]
         ↓
  Resolve → ConnectorFile[]
         ↓
  connector.sendMessage(targetId, { text: "Here is the report", files: [resolved] })
```

## Post-Completion

**Manual verification:**
- Telegram: normal file via `send_file`, say mode `<file>` tag, `mode="doc"` forcing document
- WhatsApp: same scenarios
- RLM: `generate_image` → model uses python `send_file` to deliver
