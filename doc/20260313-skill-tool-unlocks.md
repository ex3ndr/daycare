# Skill Tool Unlocks

Skills can now declare a `tools:` frontmatter list that unlocks hidden tool docs on demand.

## Flow

```mermaid
flowchart TD
    A[SKILL.md frontmatter] --> B[skillResolve parses tools list]
    B --> C[system prompt renders skill metadata with unlocked tool names]
    C --> D[tool definitions marked hiddenByDefault stay out of default Python prompt]
    D --> E[agent loads skill via skill tool]
    E --> F[skill tool prepends Python stubs for declared tools]
    F --> G[agent can use unlocked tools in later run_python blocks]
```

## Notes

- `hiddenByDefault` hides a tool from default system prompt rendering only; it does not disable execution.
- Core skills now declare the specialized tool families they unlock: tasks plus channels/signals, fragments, friends, permanent agents, and psql.
- Skill authoring docs and validators now accept the `tools` frontmatter field.
