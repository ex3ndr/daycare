# Plugins

This file documents plugin development notes that are relevant to runtime behavior changes.
For full plugin API details, see [internals/plugins.md](./internals/plugins.md).

## Plugin Skill Registration

Plugins register skills by absolute `SKILL.md` path via `registerSkill(path)`.

At runtime, registered plugin skills are:

1. Listed with all other skill sources in `Skills.list()`
2. Assigned an activation key from `skill.id`
3. Copied into per-user active runtime storage:
   `users/<userId>/skills/active/<activationKey>/SKILL.md`
4. Exposed in Docker at `/shared/skills/<activationKey>` through a read-only bind mount

```mermaid
flowchart LR
    P[Plugin registerSkill] --> L[Skills.list]
    L --> K[activationKey from skill.id]
    K --> A[skills/active/<activationKey>]
    A --> D[/shared/skills mount ro]
```
