# Agent System Prompt Build

System prompt rendering is centralized in `agentSystemPrompt()` and called from `Agent`.

`Agent` passes runtime metadata plus `agentSystem`; `agentSystemPrompt()` resolves prompt
sections from `agentSystem` in a deterministic order.

Sections resolved inside `agentSystemPrompt()`:
- plugin context (`pluginManager.getSystemPrompts()`)
- skills prompt (`Skills` + `skillPromptFormat`)
- permanent agents (`agentPermanentList` + `agentPermanentPrompt`)
- agent prompt overrides (`agentPromptResolve`)
- no-tools prompt (`rlmNoToolsPromptBuild`, when enabled)

```mermaid
flowchart TD
  A[Agent handleMessage] --> B[agentSystemPrompt]
  B --> C[Resolve prompt paths]
  B --> D[Resolve prompt sections]
  D --> D1[pluginPrompt]
  D --> D2[skillsPrompt]
  D --> D3[permanentAgentsPrompt]
  D --> D4[agentPrompt/replaceSystemPrompt]
  D --> D5[noToolsPrompt]
  B --> E[Load prompt files x5]
  B --> F[Load templates: SYSTEM/PERMISSIONS/AGENTIC]
  E --> G[Template context]
  D --> G
  F --> H[Render permissions + agentic]
  G --> H
  H --> I[Render final SYSTEM prompt]
```
