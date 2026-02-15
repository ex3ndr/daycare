# Skills

Skills are opt-in prompts stored as files on disk. They are **not** loaded into
the system prompt automatically. The agent invokes skills with the `skill` tool.
Depending on skill frontmatter, execution runs in one of two modes:

- **Embedded** (`sandbox` absent/false): tool returns SKILL.md body; caller follows instructions.
- **Forked** (`sandbox: true`): tool spawns a subagent, executes skill+prompt, returns final result.

## Where skills live

Daycare always includes core skills from:
- `packages/daycare/sources/skills/`

Plugins can register additional skills via `registerSkill(path)` with an absolute
path to a `SKILL.md` file.

Skills can also live in the config folder at `.daycare/skills/`. They are loaded
fresh each time the system prompt is built.

Daycare also loads shared user-authored skills from `~/.agents/skills/`.
This source is framework-agnostic so the same skill folder can be reused
across multiple local agent runtimes.

Each skill is a folder containing a `SKILL.md` file. The folder name becomes
the skill name shown to the agent.

The system prompt lists skills in XML tags to make parsing explicit.

## Skills catalog flow (code)

Daycare's skills catalog is coordinated by the `Skills` facade. The facade
reads all four sources (core, config, user, plugin) on demand and returns one
combined list to both prompt formatting and inference-time tool context updates.

```mermaid
flowchart TD
  Agent[Agent.handleMessage] --> SkillsFacade[Skills facade]
  SkillsFacade --> Core[skillListCore]
  SkillsFacade --> Config[skillListConfig(configDir/skills)]
  SkillsFacade --> User[skillListUser(~/.agents/skills)]
  SkillsFacade --> Plugin[skillListRegistered]
  Core[skillListCore] --> FromRoot[skillListFromRoot]
  Config --> FromRoot
  User --> FromRoot
  FromRoot --> Resolve[skillResolve]
  Resolve --> Sort[skillSort]
  Plugin --> Resolve
  Plugin --> Sort
  Sort --> SkillsList[combined AgentSkill[]]
  SkillsList --> Prompt[skillPromptFormat]
  Agent --> Loop[agentLoopRun]
  Loop --> SkillsFacade
  Loop --> SkillTool[skill tool execute()]
  SkillTool --> Content[skillContentLoad]
```

## Skill ID prefixes

`skillResolve` generates IDs by source:
- `core:<relative-path>`
- `config:<relative-path>`
- `user:<relative-path>`
- `plugin:<plugin-id>/<relative-path>`

## SKILL.md format (Agent Skills spec)

`SKILL.md` must start with YAML frontmatter followed by Markdown content.
Required frontmatter fields:
- `name`: 1-64 chars, lowercase letters/numbers/hyphens only, no leading/trailing
  hyphen, no consecutive hyphens, and it must match the parent folder name.
- `description`: 1-1024 chars describing what the skill does and when to use it.

Optional frontmatter fields include:
- `sandbox` (boolean): when true, run the skill in a forked subagent
- `permissions` (`string[]`): permission tags granted to forked subagent (must be subset of caller)
- `license`, `compatibility`, `metadata`, `allowed-tools`

When a sandboxed skill grants declared permissions to its subagent, the grant
source is labeled as `"<skill-name> Skill"` for permission attribution.

```mermaid
flowchart LR
  SkillTool[skill tool execute] --> Source[skillSourceBuild]
  Source --> Label["<skill-name> Skill"]
  Label --> Grant[grantPermission source]
```

## Loading and unloading

- **Load**: call `skill(name: "...")`; tool resolves metadata and skill body.
- **Read before inference**: skills are read from disk before each inference call.
- **Unload**: stop calling that skill.

```mermaid
flowchart TD
  Root[Skill folders] --> Catalog[Skill catalog]
  Catalog --> Prompt[System prompt lists skill metadata]
  Prompt --> ToolCall[Agent calls skill tool]
  ToolCall --> Embedded[Embedded: body returned]
  ToolCall --> Forked[Forked: subagent executes]
  Embedded --> Memory[Skill guidance in caller context]
  Forked --> Result[Subagent result returned]
```

## RLM mode skill exposure

When `rlm: true` is enabled, only `run_python` is exposed directly. The runtime
embeds the current skill catalog in the `run_python` description so Python code
can still discover and call the `skill(...)` function stub.

```mermaid
flowchart LR
  Agent[Agent.handleMessage] --> SkillsFacade[Skills facade]
  SkillsFacade --> ToolList[toolListContextBuild rlm]
  ToolList --> Desc[rlmToolDescriptionBuild]
  Desc --> Python[run_python description]
  Python --> Loop[agentLoopRun iteration]
  Loop --> SkillsFacade
  SkillsFacade --> ToolList
```
