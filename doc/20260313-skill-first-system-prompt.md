# Skill-First System Prompt

Strengthened the core prompt so reusable know-how is treated as skill material by default, not as disposable chat context.

```mermaid
flowchart TD
    A[New observation during work] --> B{Reusable later?}
    B -- no --> C[Keep in task-local context]
    B -- yes --> D{Existing skill fits?}
    D -- yes --> E[Update skill immediately]
    D -- no --> F[Create a new skill]
    E --> G[Future runs start with updated guidance]
    F --> G
```

## Changes

- `packages/daycare/sources/prompts/SYSTEM_SKILLS.md`: added explicit rules that skills are the default home for repeated workflows, tool usage patterns, outages, format drift, and durable troubleshooting knowledge.
- `packages/daycare/sources/prompts/AGENTS.md`: reinforced that reusable operational learning should be written back to skills while context is fresh, and that new tools should be paired with skill guidance.
- `packages/daycare/sources/skills/software-development/skill-creator/SKILL.md`: updated the built-in authoring guidance so skill maintenance is continuous, with concrete triggers such as server failures, format changes, and tool workarounds.

## Intent

- Make "everything reusable should become a skill" part of the default agent behavior.
- Reduce repeated rediscovery of outages, schema drift, and tool quirks.
- Push new tool adoption toward explicit skill authoring instead of implicit trial-and-error.
