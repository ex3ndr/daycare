# Role And Flavor Model Configuration

## Overview

Daycare supports two persistent model configuration layers in `settings.json`:

- `models`: role-specific overrides (`user`, `memory`, `memorySearch`, `subagent`, `heartbeat`)
- `modelFlavors`: flavor mappings used by `set_agent_model`

Role overrides use `<providerId>/<modelName>` values.
Flavor mappings use `{ model, description }`.

## Settings Format

```json
{
    "models": {
        "user": "anthropic/claude-sonnet-4-5",
        "memory": "openai/gpt-5-mini",
        "memorySearch": "openai/gpt-5-mini",
        "subagent": "anthropic/claude-haiku-4-5",
        "heartbeat": "openai/gpt-5-mini"
    },
    "modelFlavors": {
        "coding": {
            "model": "openai/codex-mini",
            "description": "Optimized for code generation"
        },
        "research": {
            "model": "google/gemini-2.5-pro",
            "description": "Best for search and extraction work"
        }
    }
}
```

Built-in flavors (`small`, `normal`, `large`) always exist and include hardcoded descriptions.
If a built-in flavor is not mapped in `modelFlavors`, Daycare resolves it from provider catalogs by size.

## Roles

| Role key | Agent descriptor types | Description |
|---|---|---|
| `user` | `user`, `permanent` | User-facing chat agents |
| `memory` | `memory-agent` | Agents that extract observations from transcripts |
| `memorySearch` | `memory-search` | Agents that search the memory graph |
| `subagent` | `subagent`, `app` | Background child agents |
| `heartbeat` | `system` (tag: `heartbeat`) | Periodic heartbeat agents |

Cron agents and non-heartbeat system agents have no dedicated role and always use the provider default.

## Precedence

```mermaid
flowchart TD
    A[Provider default model] --> B{Role config in settings.models?}
    B -- yes --> C[Apply role config: override provider + model]
    B -- no --> D[Use provider default]
    C --> E{Runtime flavor via set_agent_model?}
    D --> E
    E -- no --> H[Use resolved model]
    E -- yes --> F{settings.modelFlavors has mapping?}
    F -- yes --> G[Apply flavor mapping provider/model]
    F -- no --> I{Built-in flavor?}
    I -- yes --> J[Select by provider catalog size]
    I -- no --> H
    G --> H
    J --> H
```

1. **Runtime flavor override** (`set_agent_model` with built-in or custom flavor name) — highest priority, ephemeral per-agent session
2. **Flavor mapping config** (`settings.modelFlavors`) — persistent mapping for flavor values
3. **Settings role config** (`settings.models[role]`) — persistent role defaults
4. **Provider default** — the model configured on the provider entry

## CLI

```bash
# View current role + flavor assignments
daycare models --list

# Interactive: configure a role assignment or flavor assignment
daycare models

# With custom settings path
daycare models -s /path/to/settings.json
```

The interactive mode validates selected provider/model values before saving.

## Architecture

```mermaid
flowchart LR
    subgraph Settings
        S1[settings.models]
        S2[settings.modelFlavors]
    end

    subgraph Resolution
        R1[agentDescriptorRoleResolve] --> R2[modelRoleApply]
        R2 --> R3[agentModelOverrideApply]
    end

    subgraph Agent
        A1[Agent.handleMessage] --> R1
        R3 --> A2[InferenceRouter.complete]
    end

    S1 --> R2
    S2 --> R3
```

| Component | File | Role |
|---|---|---|
| `ModelRoleConfig` / `ModelFlavorConfig` | `packages/daycare/sources/settings.ts` | Settings types for role and flavor overrides |
| `modelRoleApply` | `packages/daycare/sources/providers/modelRoleApply.ts` | Applies configured `provider/model` override |
| `agentModelOverrideApply` | `packages/daycare/sources/engine/agents/ops/agentModelOverrideApply.ts` | Applies runtime flavor and `modelFlavors` mapping |
| `set_agent_model` tool | `packages/daycare/sources/engine/modules/tools/agentModelSetToolBuild.ts` | Runtime flavor override (`small|normal|large` + custom) |
| `modelsCommand` | `packages/daycare/sources/commands/models.ts` | CLI for role + flavor assignments |
