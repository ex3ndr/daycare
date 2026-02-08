# Skills

Skills are opt-in prompts stored as files on disk. They are **not** loaded into the system prompt automatically. Agents load skills on demand by reading the file path listed in the system prompt.

## Where skills live

| Location | Purpose |
|----------|---------|
| `packages/daycare/sources/skills/` | Core built-in skills |
| `.daycare/skills/` | User-defined skills |
| Plugin-registered via `registerSkill(path)` | Plugin-provided skills |

Each skill is a folder containing a `SKILL.md` file. The folder name becomes the skill name shown to the agent.

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

1. The system prompt lists available skills with their absolute file paths
2. An agent reads the skill file on demand when it needs the guidance
3. Skill guidance becomes part of the agent's context

Skills are loaded fresh each time the system prompt is built, so edits take effect immediately.
