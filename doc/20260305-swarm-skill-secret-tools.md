# Swarm Skill and Secret Tools

## Summary
- Added tool `skill_eject` to copy a personal skill folder to a sandbox path.
- Extended `skill_add` with optional `userId` to install into a caller-owned swarm.
- Added tool `secret_copy` to copy one owner secret to a caller-owned swarm.
- Extended `secret_add` and `secret_remove` with optional `userId` for swarm-scoped operations.
- Added API endpoint `POST /skills/eject`.
- Added swarm secret API endpoints under `/swarms/:nametag/secrets/*`.

## Flow
```mermaid
flowchart TD
    A[Owner agent/app request] --> B{Operation}
    B -->|skill_eject| C[Find personal skill by SKILL.md name]
    C --> D[Resolve writable destination]
    D --> E[Copy skill folder]

    B -->|skill_add userId| F[Verify caller owner + swarm ownership]
    F --> G[Resolve swarm skills/personal root]
    G --> H[Install skill folder]

    B -->|secret_copy / secret_add / secret_remove userId| I[Verify caller owner + swarm ownership]
    I --> J[Build swarm-scoped context]
    J --> K[Read/write swarm secrets.json]
```

## API Endpoints
- `POST /skills/eject`
- `GET /swarms/:nametag/secrets`
- `POST /swarms/:nametag/secrets/copy`
- `POST /swarms/:nametag/secrets/create`
- `POST /swarms/:nametag/secrets/:name/update`
- `POST /swarms/:nametag/secrets/:name/delete`
