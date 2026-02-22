# Agent Model Override

## Overview
Add per-agent model override so that any agent's inference model can be changed dynamically at runtime. A new `set_agent_model` tool (visible only to foreground agents) lets the calling agent change the model used by any target agent. The override is stored in `AgentState` and picked up on the target agent's next inference loop iteration.

**Defaults**: All agents use "normal" (sonnet-class) models by default via `providerModelSelectBySize`.
**Selectors**: `"small"`, `"normal"`, `"big"` map to provider model sizes. A direct model name string is also accepted but must be validated with a micro inference call before storing.
**Access control**: Only foreground (`type: "user"`) agents see the tool.

## Context
- `AgentState` in `agentTypes.ts` holds per-agent runtime state, persisted via `agentStateWrite`.
- `Agent.handleMessage()` calls `resolveAgentProvider()` and builds `providersForAgent` which is passed to `agentLoopRun()` → `InferenceRouter.complete()` via `providersOverride`.
- `PluginInferenceService` already has a `strategy` concept (`"small"/"normal"/"large"`) with `providerModelSelectBySize()`.
- `AgentSystem` has `updateAgentDescriptor()` / `updateAgentPermissions()` patterns for in-memory agent mutation.
- Tools register in `engine.ts` via `this.modules.tools.register("core", ...)` and gate visibility via `visibleByDefault`.

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Implementation Steps

### Task 1: Add `modelOverride` field to `AgentState`
- [ ] Add `modelOverride?: AgentModelOverride | null` to `AgentState` in `agentTypes.ts`
- [ ] Define `AgentModelOverride` type: `{ type: "selector"; value: "small" | "normal" | "big" } | { type: "model"; value: string }` in `agentTypes.ts`
- [ ] Export `AgentModelOverride` from `@/types` if needed
- [ ] No tests needed (type-only change); run `yarn typecheck` to verify

### Task 2: Apply model override in `Agent.handleMessage()`
- [ ] Create `agentModelOverrideApply.ts` in `engine/agents/ops/` — pure function that takes `(providers: ProviderSettings[], override: AgentModelOverride | null | undefined, providerId: string)` and returns a modified `ProviderSettings[]` with the model field overridden
  - For `selector` type: use `providerModelSelectBySize()` to resolve model name from the provider's model catalog, then override `provider.model`
  - For `model` type: directly override `provider.model` with the stored value
  - For `null`/`undefined`: return providers unchanged (no override = use provider default, which is the configured model)
- [ ] In `Agent.handleMessage()`, after `resolveAgentProvider()` and before building `providersForAgent`, apply the override: `const resolvedProviders = agentModelOverrideApply(providers, this.state.modelOverride, providerId)`
- [ ] Wire `resolvedProviders` into the rest of `handleMessage` (both for compaction and for `agentLoopRun`)
- [ ] Write tests for `agentModelOverrideApply` (selector small/normal/big, direct model, null passthrough)
- [ ] Run tests — must pass before next task

### Task 3: Add `updateAgentModelOverride` method to `AgentSystem`
- [ ] Add method `updateAgentModelOverride(agentId: string, override: AgentModelOverride | null): boolean` to `AgentSystem`
  - Finds the entry, sets `entry.agent.state.modelOverride`, persists via `agentStateWrite`, returns true
  - Returns false if agent not found
- [ ] No separate tests needed (integration-level, will be tested via tool tests); run `yarn typecheck`

### Task 4: Create `set_agent_model` tool
- [ ] Create `agentModelSetToolBuild.ts` in `engine/modules/tools/`
- [ ] Schema: `{ agentId: string, model: "small" | "normal" | "big" | string }` — when value is one of the three selectors, store as `{ type: "selector", value }`. Otherwise store as `{ type: "model", value }`.
- [ ] For `type: "model"` (direct model name): perform a micro inference call to validate the model works before storing. Use `InferenceRouter.complete()` with a minimal context (single "hi" message, no tools). If it fails, return error to the calling agent.
- [ ] Gate with `visibleByDefault: (context) => context.descriptor.type === "user"` — only foreground agents
- [ ] The tool calls `agentSystem.updateAgentModelOverride(targetAgentId, override)` to apply
- [ ] Return success text with the applied model info
- [ ] Write tests for the tool (selector path, direct model name path, visibility gating)
- [ ] Run tests — must pass before next task

### Task 5: Register tool and wire into engine
- [ ] Register `agentModelSetToolBuild()` in `engine.ts` alongside other core tools
- [ ] Pass `inferenceRouter` to the tool builder so it can perform validation inference calls
- [ ] Run `yarn typecheck` and `yarn test` — must pass

### Task 6: Verify acceptance criteria
- [ ] Verify foreground agent can see the tool, background agents cannot
- [ ] Verify selector values ("small"/"normal"/"big") are stored and applied correctly
- [ ] Verify direct model name triggers validation inference call
- [ ] Verify override persists across agent sleep/wake cycles (via `agentStateWrite`/`agentStateRead`)
- [ ] Run full test suite (unit tests)
- [ ] Run linter — all issues must be fixed

### Task 7: Update documentation
- [ ] Add docs about `set_agent_model` tool to relevant plugin/tool docs

## Technical Details

### AgentModelOverride type
```typescript
export type AgentModelOverride =
    | { type: "selector"; value: "small" | "normal" | "big" }
    | { type: "model"; value: string };
```

### Override application flow
```
Agent.handleMessage()
  → listActiveInferenceProviders(settings)
  → resolveAgentProvider(providers) → providerId
  → agentModelOverrideApply(providers, state.modelOverride, providerId)
    ├── selector → providerModelSelectBySize(definition.models, selectorToSize)
    │                → override provider.model
    ├── model   → override provider.model directly
    └── null    → passthrough (use configured default)
  → build providersForAgent with overridden model
  → agentLoopRun({ providersForAgent, ... })
```

### Selector-to-size mapping
| Selector | ProviderModelSize |
|----------|------------------|
| "small"  | "small"          |
| "normal" | "normal"         |
| "big"    | "large"          |

### Micro validation inference call
For direct model names, the tool performs:
```typescript
await inferenceRouter.complete(
    { messages: [{ role: "user", content: "hi", timestamp: Date.now() }], systemPrompt: "Reply with 'ok'." },
    `model-validation:${createId()}`,
    { providersOverride: [{ ...provider, model: directModelName }] }
);
```
If this throws, the tool returns an error and does NOT store the override.

## Post-Completion
- Manual testing: verify via Telegram/WhatsApp that a foreground agent can switch its subagent's model mid-conversation
- Verify token stats correctly reflect the overridden model name
