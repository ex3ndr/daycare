# Users Engine Module

This module provides per-user filesystem isolation under `config.usersDir`:

```text
<configDir>/users/<userId>/
  skills/
    active/
      <activationKey>/
        SKILL.md
    personal/
      <skill-folder>/
        SKILL.md
  apps/
    <app-id>/
      APP.md
      PERMISSIONS.md
      data/
      state.json
  home/
    downloads/
    desktop/
    documents/
    developer/
    tmp/
```

Versioned system prompts now live in the vault:

```text
vault://system/
  soul
  user
  agents
  tools
```

## Components

- `userHome.ts`: `UserHome` facade for user-scoped path resolution.
- `userHomeEnsure.ts`: creates the user directory tree for filesystem workspaces.

## Resolution Flow

```mermaid
flowchart TD
    A[AgentSystem resolves userId] --> B[UserHome(usersDir, userId)]
    B --> C[userHomeEnsure]
    C --> D[skills/active, skills/personal, apps, home/* directories]
    B --> F[permissionBuildUser]
    F --> G[Agent session permissions + skills active read access]
    B --> H[Agent files facade: home/downloads, home/desktop, home/tmp]
    A --> I[vaultSystemDocsEnsure]
    I --> J[vault://system/{soul,user,agents,tools}]
```
