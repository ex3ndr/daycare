# Memory

Shared guidance for the memory subsystem.

Use this folder document for rules that apply across memory agents, search agents, and compaction.

Default policy:
- Keep `vault://memory/*` dense, factual, and deduplicated.
- Prefer merging related facts into existing nodes over creating parallel duplicates.
- Compress low-signal or stale detail when it no longer improves retrieval.
- Preserve important entities, decisions, relationships, constraints, and lessons learned.
- Keep role-specific prompts in `vault://system/memory/agent`, `vault://system/memory/search`, and `vault://system/memory/compactor`.
