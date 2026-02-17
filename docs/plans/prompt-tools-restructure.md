# Restructure System Prompt: Extract Tool-Mode Templates & Fix Duplicate Skills

## Overview
- Extract RLM and RLM-Inline tool-mode prompt text from TypeScript builders into `.md` Handlebars templates (`SYSTEM_TOOLS_RLM.md`, `SYSTEM_TOOLS_RLM_INLINE.md`) in `sources/prompts/`
- Remove skill lists from RLM/Inline tool descriptions — skills appear **only once** via `skillsPrompt` in the system prompt
- Make the static "Skills" section (SYSTEM.md lines 149-156) available to **all** agents, not just foreground
- No new TOOLS_CLASSIC template needed — classic mode keeps current structure

## Context (from discovery)
- **Three tool modes**: Classic (`rlm=false`), RLM (`rlm=true, noTools=false`), RLM-Inline/NoTools (`rlm+noTools+say`)
- **Duplicate skills bug**: `skillsPrompt` (SYSTEM.md line 229) is always injected. In RLM mode, skills also appear in `run_python` tool description. In no-tools mode, skills also appear in `noToolsPrompt`. Result: skills listed twice.
- **Skills section gated**: Static Skills explanation (SYSTEM.md lines 149-156) only shown to foreground agents via `{{#if isForeground}}`

### Key files:
- `sources/prompts/SYSTEM.md` — main system prompt template
- `sources/engine/modules/rlm/rlmToolDescriptionBuild.ts` — builds `run_python` tool description (RLM mode)
- `sources/engine/modules/rlm/rlmNoToolsPromptBuild.ts` — builds no-tools prompt section (RLM-Inline mode)
- `sources/engine/modules/rlm/rlmPreambleBuild.ts` — generates Python function stubs (shared by both RLM modes)
- `sources/engine/skills/skillPromptFormat.ts` — formats skills into XML for system prompt
- `sources/engine/agents/agent.ts` — orchestrates prompt assembly (lines 370-475, 1191-1300)
- `sources/engine/modules/tools/toolListContextBuild.ts` — builds context tool list per mode

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Implementation Steps

### Task 1: Create SYSTEM_TOOLS_RLM.md template
- [ ] Create `sources/prompts/SYSTEM_TOOLS_RLM.md` with the static prose from `rlmToolDescriptionBuild()` and `{{{preamble}}}` Handlebars variable — **no skills section**
- [ ] Update `rlmToolDescriptionBuild()` to load and render the `.md` template instead of assembling lines in code
- [ ] Remove `rlmSkillsSectionBuild()` and the `skills` parameter from `rlmToolDescriptionBuild()`
- [ ] Update callers: `toolListContextBuild.ts` — stop passing `skills` to `rlmToolDescriptionBuild()`
- [ ] Update `rlmToolDescriptionBuild.spec.ts` tests — remove skills-related assertions, verify template rendering
- [ ] Run tests — must pass before next task

### Task 2: Create SYSTEM_TOOLS_RLM_INLINE.md template
- [ ] Create `sources/prompts/SYSTEM_TOOLS_RLM_INLINE.md` with the static prose from `rlmNoToolsPromptBuild()` and `{{{preamble}}}` Handlebars variable — **no skills section**
- [ ] Update `rlmNoToolsPromptBuild()` to load and render the `.md` template instead of assembling lines in code
- [ ] Remove `rlmNoToolsSkillsSectionBuild()` and the `skills` parameter from `rlmNoToolsPromptBuild()`
- [ ] Update caller: `agent.ts` line 417 — stop passing `availableSkills` to `rlmNoToolsPromptBuild()`
- [ ] Update or create tests for `rlmNoToolsPromptBuild` — verify template rendering, no skills in output
- [ ] Run tests — must pass before next task

### Task 3: Fix duplicate skills in system prompt
- [ ] In SYSTEM.md, remove the `{{#if isForeground}}` guard from the static Skills section (lines 145-157) so all agents see skill instructions
- [ ] Verify `skillsPrompt` (line 229) remains the single source of the skills list for all modes — no conditional changes needed since RLM/Inline no longer embed skills
- [ ] Verify the static Skills section and dynamic `skillsPrompt` section don't conflict
- [ ] Write a test or assertion verifying skills appear exactly once in the rendered prompt for each mode
- [ ] Run tests — must pass before next task

### Task 4: Verify acceptance criteria
- [ ] Verify: Classic mode — skills appear via `skillsPrompt` in system prompt only (no change in behavior)
- [ ] Verify: RLM mode — `run_python` tool description has no skills; skills appear via `skillsPrompt` only
- [ ] Verify: No-tools mode — `noToolsPrompt` has no skills; skills appear via `skillsPrompt` only
- [ ] Verify: Background agents see the static Skills section
- [ ] Run full test suite (`yarn test`)
- [ ] Run typecheck (`yarn typecheck`)

### Task 5: [Final] Update documentation
- [ ] Update `sources/engine/modules/rlm/README.md` to reflect template-based approach and skills consolidation
- [ ] Add brief comments in new template files explaining their role

## Technical Details

### Template structure — SYSTEM_TOOLS_RLM.md
```markdown
Execute Python code to complete the task.

The following functions are available:
\`\`\`python
{{{preamble}}}
\`\`\`

Call tool functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
The value of the final expression is returned.
```

### Template structure — SYSTEM_TOOLS_RLM_INLINE.md
```markdown
## Python Execution

This mode exposes zero tools to the model.
To execute Python, write code inside `<run_python>...</run_python>` tags.
Emit at most one Python block per assistant response.
... (remaining static prose)

Available functions:
\`\`\`python
{{{preamble}}}
\`\`\`

Call functions directly (no `await`).
Use `try/except ToolError` for tool failures.
Use `print()` for debug output.
... (remaining static prose)
```

### Skills section change in SYSTEM.md
Move the static Skills section out of `{{#if isForeground}}`:
```handlebars
{{!-- Before: inside isForeground block --}}
{{!-- After: standalone section visible to all agents --}}

## Skills

Invoke skills via the `skill` tool. Do not read `SKILL.md` files directly.

- Non-sandbox skills: `skill` returns instructions; follow them in this context.
- Sandbox skills: `skill` runs autonomously in a subagent and returns results.
```

The foreground-only skill authoring instructions (line 156) should stay in the foreground block.

### Template loading
Use the existing `agentPromptBundledRead()` helper (used for SYSTEM.md, PERMISSIONS.md, AGENTIC.md) to load the new templates. Render with Handlebars like the other templates.

## Post-Completion

**Manual verification:**
- Test with each mode enabled (classic, RLM, no-tools) to confirm skills appear exactly once
- Inspect rendered system prompt snapshots in agent folders
