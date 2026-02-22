# System Models Prompt

## Overview
Add a new system prompt section `SYSTEM_MODELS.md` that gives agents awareness of all available inference models across configured providers, including vendor-specific strengths/weaknesses narratives, and actionable guidance on when/how to switch models using `set_agent_model`.

The prompt is rendered dynamically: at build time, the active providers and their model catalogs are injected via Handlebars so the information stays current without manual maintenance.

## Context (from discovery)
- **Prompt template**: `packages/daycare/sources/prompts/SYSTEM_MODELS.md` (new file)
- **Section builder**: `packages/daycare/sources/engine/agents/ops/agentSystemPromptSectionModels.ts` (new file)
- **Section assembly**: `packages/daycare/sources/engine/agents/ops/agentSystemPrompt.ts` — add the new section to the `Promise.all` array
- **Prompt context**: `packages/daycare/sources/engine/agents/ops/agentSystemPromptContext.ts` — already has `agentSystem` which provides access to `config.current.settings`
- **Model catalog**: `packages/daycare/sources/providers/models.ts` — `PROVIDER_MODELS` keyed by provider id
- **Provider catalog**: `packages/daycare/sources/providers/catalog.ts` — `listActiveInferenceProviders(settings)`
- **Model types**: `packages/daycare/sources/providers/types.ts` — `ProviderModelInfo`, `ProviderModelSize`
- **Model override tool**: `packages/daycare/sources/engine/modules/tools/agentModelSetToolBuild.ts` — `set_agent_model`

### Patterns discovered
- Each system prompt section has: a Handlebars `.md` template + a `agentSystemPromptSection*.ts` builder function
- Builders receive `AgentSystemPromptContext`, read the template via `agentPromptBundledRead()`, compile with Handlebars, return trimmed string
- All sections are rendered in parallel via `Promise.all` in `agentSystemPrompt.ts`
- The section is visible to all agent types (foreground + background) — no `isForeground` gating needed

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Testing Strategy
- **Unit tests**: test the section builder function renders correctly with mock context
- **Integration**: existing `agentSystemPrompt.spec.ts` tests confirm the full prompt assembly still works

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Create the SYSTEM_MODELS.md Handlebars template
- [x] Create `packages/daycare/sources/prompts/SYSTEM_MODELS.md` with:
  - Section header "## Model Awareness"
  - Subsection showing current model/provider: `You are running on **{{currentModel}}** via **{{currentProvider}}**`
  - Subsection "### Available Models" listing all configured providers with their non-deprecated models (injected dynamically as `{{{availableModels}}}` — triple-brace for unescaped HTML/markdown)
  - Subsection "### Model Capabilities by Vendor" with narrative strengths/weaknesses for major vendors (Anthropic, OpenAI, Google, Mistral, Meta/Llama, xAI, DeepSeek, etc.)
  - Subsection "### Model Selection Strategy" with guidance on when to use `set_agent_model` and the selector shortcuts (`"small"`, `"normal"`, `"big"`)
- [x] Verify template renders correctly with sample data (manual inspection)

### Task 2: Create the section builder function
- [x] Create `packages/daycare/sources/engine/agents/ops/agentSystemPromptSectionModels.ts`
- [x] Implement `agentSystemPromptSectionModels(context)` that:
  - Reads `SYSTEM_MODELS.md` via `agentPromptBundledRead`
  - Extracts active providers from `context.agentSystem.config.current.settings` using `listActiveInferenceProviders`
  - Looks up each provider's models from `PROVIDER_MODELS`, filtering out deprecated ones
  - Formats the model list as markdown (grouped by provider, showing name and size tier)
  - Compiles the Handlebars template with `{ currentModel, currentProvider, availableModels }`
  - Returns trimmed string (empty string if no agentSystem in context, so it's a no-op for minimal contexts)
- [x] Write tests for `agentSystemPromptSectionModels` (success case with mock providers, empty case with no agentSystem)
- [x] Write tests for edge cases (provider with no models in catalog, unknown provider id)
- [x] Run tests — must pass before next task

### Task 3: Wire the new section into agentSystemPrompt
- [x] Import `agentSystemPromptSectionModels` in `agentSystemPrompt.ts`
- [x] Add it to the `Promise.all` array in `agentSystemPrompt()` (after environment, before the join)
- [x] Verify existing tests in `agentSystemPrompt.spec.ts` still pass
- [x] Run full test suite — must pass before next task

### Task 4: Verify acceptance criteria
- [x] Verify the prompt includes dynamic model listing from configured providers
- [x] Verify vendor capability narratives are present
- [x] Verify `set_agent_model` guidance is included
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed
- [x] Run typecheck — must pass

### Task 5: Update documentation
- [x] Update `doc/` if there's an existing prompt documentation file that should reference the new section

## Technical Details

### Template variables
| Variable | Type | Source |
|---|---|---|
| `currentModel` | string | `context.model ?? "unknown"` |
| `currentProvider` | string | `context.provider ?? "unknown"` |
| `availableModels` | string (pre-rendered markdown) | Built from `PROVIDER_MODELS` + active provider list |

### Model list formatting (pre-rendered before Handlebars)
```
**Anthropic**: Claude Opus 4.5 (large), Claude Sonnet 4.5 (normal), Claude Haiku 4.5 (small)
**OpenAI**: GPT-5.2 Chat (normal), GPT-5.1 Chat (normal), ...
**Google**: Gemini 2.5 Pro (normal), Gemini 2.5 Flash (small), ...
```

### Vendor capability narratives (static in template)
Hardcoded in the `.md` template since these change infrequently and require human judgment. Covers: Anthropic (Claude), OpenAI (GPT), Google (Gemini), Mistral, Meta (Llama), xAI (Grok), DeepSeek, and a catch-all for other vendors.

## Post-Completion
- Review whether the prompt is too long and consider trimming model lists for providers with many models (e.g., Amazon Bedrock has 50+ models)
- Consider whether to add a feature flag to enable/disable the models section
