# Skill Categories

- Core built-in skills now live under category folders such as `software-development/`, `research/`, `media/`, `creative/`, `data/`, and `autonomous-ai-agents/`.
- Skill discovery remains recursive and only loads `SKILL.md`, so category-level files do not become skills.
- Skill metadata now exposes a derived `category` field and the app groups skills by category.

```mermaid
flowchart TD
  Root[packages/daycare/sources/skills] --> Category[category folder]
  Category --> SkillDir[skill folder]
  SkillDir --> SkillFile[SKILL.md]
  SkillFile --> Scan[skillListFromRoot]
  Scan --> Resolve[skillResolve relative path]
  Resolve --> CategoryField[derive category from first path segment]
  Resolve --> SkillId[core:category/skill]
  CategoryField --> Api[/skills response]
  CategoryField --> Prompt[available_skills XML]
  CategoryField --> App[Skills screen groups]
```
