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

Versioned system prompts now live in the document store:

```text
~/system/
  soul
  user
  agents
  tools
```

## Components

- `userHome.ts`: `UserHome` facade for user-scoped path resolution.
- `userHomeEnsure.ts`: creates the user directory tree for filesystem workspaces.
- `userHomeMigrate.ts`: one-time migration of legacy prompt files into owner user documents.

## Resolution Flow

```mermaid
flowchart TD
    A[AgentSystem resolves userId] --> B[UserHome(usersDir, userId)]
    B --> C[userHomeEnsure]
    C --> D[skills/active, skills/personal, apps, home/* directories]
    B --> F[permissionBuildUser]
    F --> G[Agent session permissions + skills active read access]
    B --> H[Agent files facade: home/downloads, home/desktop, home/tmp]
    A --> I[documentSystemDocsEnsure]
    I --> J[~/system/{soul,user,agents,tools}]
```

## Migration Flow

```mermaid
sequenceDiagram
    participant Engine
    participant Migrate as userHomeMigrate
    participant DB as SQLite Users
    participant FS as Filesystem

    Engine->>Migrate: start(config)
    Migrate->>FS: check users/.migrated
    alt marker exists
        Migrate-->>Engine: skip
    else no marker
        Migrate->>DB: resolve/create owner user
        Migrate->>FS: ensure owner UserHome
        Migrate->>DB: ensure ~/system documents
        Migrate->>FS: read legacy knowledge files if present
        Migrate->>DB: update ~/system child documents
        Migrate->>FS: write users/.migrated
        Migrate-->>Engine: complete
    end
```
