# Skills

Skills are opt-in prompts stored as files on disk. They are **not** loaded into the system prompt automatically. Agents invoke skills via the `skill` tool.

## Where skills live

| Location | Purpose |
|----------|---------|
| `packages/daycare/sources/skills/` | Core built-in skills (may be grouped into category folders) |
| `~/.daycare/skills/` | Config-local skills |
| `~/.agents/skills/` | Shared home-directory skills |
| Plugin-registered via `registerSkill(path)` | Plugin-provided skills |

Each skill is a folder containing a `SKILL.md` file. Core skills may be nested under category folders such as `software-development/` or `research/`. The leaf folder name becomes the skill name shown to the agent.

## SKILL.md format

```markdown
---
name: my-skill
description: Brief description of what this skill does and when to use it.
---

Skill content in Markdown...
```

### Required frontmatter

| Field | Constraints |
|-------|------------|
| `name` | 1-64 chars, lowercase letters/numbers/hyphens, must match folder name |
| `description` | 1-1024 chars |

### Optional frontmatter

`license`, `compatibility`, `metadata`, `allowed-tools`

## Loading

1. The system prompt lists available skills with metadata (category, name, description, source, sandbox flag)
2. The agent calls `skill(name: "...")`
3. Non-sandbox skills return instructions to follow in-context; sandbox skills run in a subagent and return results

Skills are loaded fresh each time the system prompt is built, so edits take effect immediately.

## Sandbox execution

Add optional frontmatter for isolated runs:

```markdown
---
name: deploy
description: Deploy application safely.
sandbox: true
permissions:
  - "@read:/workspace"
  - "@network"
---
```

When `sandbox: true`, the `skill` tool creates a subagent, grants declared permissions (bounded by caller permissions), executes the skill with the provided prompt, and returns the subagent response.

```mermaid
sequenceDiagram
  participant A as Agent
  participant T as skill tool
  participant S as AgentSystem
  participant B as Subagent

  A->>T: skill(name, prompt)
  T->>T: resolve skill + load SKILL.md body
  alt sandbox false
    T-->>A: embedded instructions
  else sandbox true
    T->>S: create subagent + grant permissions
    T->>S: postAndAwait(skill body + task)
    S->>B: execute
    B-->>S: final response
    S-->>T: responseText
    T-->>A: sandbox result
  end
```

## Skill IDs

The skill catalog uses stable ID prefixes by source:
- `core:<relative-path>`
- `config:<relative-path>`
- `user:<relative-path>`
- `plugin:<plugin-id>/<relative-path>`

For categorized core skills, the relative path includes the category folder. Example:
- `packages/daycare/sources/skills/software-development/code-review/SKILL.md`
- skill id: `core:software-development/code-review`
