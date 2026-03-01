# Task Creation Skill

## Summary

Added a new core skill at `packages/daycare/sources/skills/task-creation/SKILL.md`.
The skill is sandboxed (`sandbox: true`) so it runs asynchronously in a subagent and focuses on robust task authoring:

- minimal Python orchestration
- offloading complex logic through `exec`
- strict `allowedDomains` usage for networked commands
- runtime `json_parse` / `json_stringify` for safe JSON handling in task Python
- aggressive `skip()` usage for no-op and mechanical runs
- clear trigger selection and validation workflow

## Flow

```mermaid
flowchart TD
    A[Receive automation request] --> B[Choose trigger: cron heartbeat webhook]
    B --> C[Create or update task with typed parameters]
    C --> D[Write minimal orchestration code]
    D --> E{Need heavy logic?}
    E -- Yes --> F[Offload via exec to script]
    E -- No --> G[Keep inline orchestration]
    F --> H{Need LLM reasoning now?}
    G --> H
    H -- No --> I[Call skip early]
    H -- Yes --> J[Print minimal context for reasoning]
    I --> K[Attach trigger and validate]
    J --> K
    K --> L[task_run sync test + task_read verify]
```
