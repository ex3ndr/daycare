# Skill Tool Read Sandbox Enforcement

## Summary

The `skill` tool now enforces sandbox read permissions before loading any skill file.

Before this change, path-based skill requests could resolve and read `SKILL.md` files without passing through sandbox read checks.

Now both flows are gated by `sandboxCanRead(...)`:
- direct path input (`skill(name: "./path/to/SKILL.md")`)
- named skill input (`skill(name: "deploy")`) before loading the resolved skill body

## Flow

```mermaid
flowchart TD
    A[skill tool request] --> B{input looks like path?}
    B -->|yes| C[resolve path from workingDir]
    C --> D[sandboxCanRead permissions check]
    D --> E[skillResolve frontmatter]
    B -->|no| F[resolve from registered skills]
    F --> G[sandboxCanRead on resolved skill path]
    G --> H[skillContentLoad]
    E --> H
    H --> I[embedded response or sandbox subagent]
```

## Security Impact

Skill file reads now honor approved read scope and sandbox deny policy, preventing arbitrary file loading through the `skill` tool.
