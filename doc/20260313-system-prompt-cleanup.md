# System Prompt Cleanup

Reduced redundant guidance in the core system prompts so the model sees fewer repeated rules and fewer conflicting delegation instructions.

```mermaid
flowchart TD
    A[Prompt review findings] --> B[Simplify SYSTEM_AGENCY]
    A --> C[Collapse SYSTEM_MODELS routing]
    A --> D[Deduplicate SYSTEM_TOPOLOGY tasks note]
    A --> E[Trim SYSTEM_MEMORY usage repeat]
    A --> F[Trim SYSTEM_PERMISSIONS network repeat]
    B --> G[Shorter, less conflicting prompt]
    C --> G
    D --> G
    E --> G
    F --> G
```

## Changes

- `SYSTEM_AGENCY.md`: replaced repeated "delegate everything" language with a single rule to use subagents when they improve focus or reliability; replaced the low-signal helpfulness paragraph with a concise artifact-first instruction.
- `SYSTEM_MODELS.md`: removed the repeated vendor prose and table; kept one compact routing heuristic list plus `set_agent_model` guidance.
- `SYSTEM_TOPOLOGY.md`: merged the duplicate `tasks` skill pointer into a single intro paragraph and removed the repeated signals/channels section at the end.
- `SYSTEM_MEMORY.md`: removed the numbered usage pattern that repeated the sync/async guidance already listed above.
- `SYSTEM_PERMISSIONS.md`: removed the repeated network section and kept internet access in the opening summary.
