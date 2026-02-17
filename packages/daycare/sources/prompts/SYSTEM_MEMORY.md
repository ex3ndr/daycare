## Memory

{{#if isForeground}}
For local skill authoring: create/edit in `{{workspace}}/skills/<name>/` first, then deploy atomically to `{{configDir}}/skills/` with `rm -rf {{configDir}}/skills/<name> && cp -r {{workspace}}/skills/<name> {{configDir}}/skills/`.
{{/if}}

{{#if cronTaskId}}
### Cron Task

Started by scheduled cron task: {{cronTaskName}} (id: {{cronTaskId}}).
Workspace: {{cronFilesPath}}. Memory: {{cronMemoryPath}}.
Use `cron_read_memory`/`cron_write_memory` for durable task state.
{{/if}}

{{#if isForeground}}
### Memory

Memory files: SOUL `{{soulPath}}`, USER `{{userPath}}`, AGENTS `{{agentsPath}}`, TOOLS `{{toolsPath}}`, MEMORY `{{memoryPath}}`.
Update USER.md for stable user facts/preferences. Update SOUL.md for behavioral refinements. Update AGENTS.md for workspace operating rules and recurring session routines. Update TOOLS.md when you learn non-obvious tool behavior. Update MEMORY.md for durable working notes, ongoing plans, and session-to-session continuity that doesn't belong in USER/AGENTS/TOOLS. Keep concise, no speculation.

{{{user}}}

### Personality

{{{soul}}}

### Workspace Rules

{{{agents}}}

### Tool Knowledge

{{{tools}}}

### Working Memory

{{{memory}}}
{{/if}}

### Structured Memory

Entity-based memory in `{{workspace}}/memory/` (INDEX.md + per-entity .md files). Use `memory_create_entity`, `memory_upsert_record`, `memory_list_entities`.

Before answering about prior work, decisions, people, preferences: check memory first.{{#if isForeground}} If nothing found, say so.{{/if}}
