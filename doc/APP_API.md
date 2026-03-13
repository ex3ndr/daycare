# Daycare App API

Date: 2026-03-01

## Overview
Authenticated requests require:

`Authorization: Bearer <token>`

Response envelope convention:
- Success: `{ ok: true, ... }`
- Failure: `{ ok: false, error: string }`

Mutation convention:
- New app mutations use `POST` action paths.
- Legacy compatibility exceptions remain on prompt routes listed below.

## API Flow
```mermaid
flowchart TD
    A[App Client] --> B[AppServer.requestHandle]
    B --> C[appAuthExtract]
    C --> D[ctx = contextForUser]

    D --> E[/events SSE]
    D --> F[apiRouteHandle]

    F --> G[/profile]
    F --> H[/agents]
    F --> I[/tasks]
    F --> J[/skills]
    F --> O[/swarms]
    F --> K[/vault]
    F --> L[/prompts]
    F --> M[/costs]
    F --> N[/kv]
```

## SSE Lifecycle
```mermaid
sequenceDiagram
    participant Client
    participant AppServer
    participant EventBus

    Client->>AppServer: GET /events (Bearer token)
    AppServer-->>Client: data: {"type":"connected","timestamp":"..."}
    EventBus-->>AppServer: EngineEvent { type, payload, timestamp }
    AppServer-->>Client: data: {"type":"...","payload":...,"timestamp":"..."}
    Client-->>AppServer: close connection
    AppServer->>EventBus: unsubscribe listener
```

## Auth Routes
- `POST /auth/validate`
- `POST /auth/refresh`
- `POST /auth/telegram`

## Web App Auth Logging
The web app logs the authenticated user id to the browser console after token validation during:
- login
- bootstrap from stored session
- bootstrap from resolved session

```mermaid
flowchart LR
    A[Token] --> B[/auth/validate]
    B --> C{ok + userId}
    C -->|yes| D[console.info userId]
```

Example:
```json
{ "token": "<jwt>" }
```

## Profile Routes
- `GET /profile`
- `POST /profile/update`

`GET /profile` response:
```json
{
    "ok": true,
    "profile": {
        "firstName": "Ada",
        "lastName": "Lovelace",
        "bio": null,
        "about": null,
        "country": "UK",
        "timezone": "Europe/London",
        "systemPrompt": null,
        "memory": true,
        "nametag": "ada"
    }
}
```

`POST /profile/update` body (all optional):
```json
{
    "firstName": "Ada",
    "lastName": null,
    "bio": "Short bio",
    "about": "More about me",
    "country": "UK",
    "timezone": "Europe/London",
    "systemPrompt": "Be concise.",
    "memory": true
}
```

## Agent Routes
- `GET /agents`
- `GET /agents/:id/history?limit=N`
- `POST /agents/:id/message`

`POST /agents/:id/message` body:
```json
{ "text": "Summarize yesterday's updates" }
```

## Events Route
- `GET /events` (SSE)

Event frame format:
```text
data: {"type":"connected","timestamp":"2026-03-01T12:00:00.000Z"}

data: {"type":"agent.created","payload":{"agentId":"a1"},"timestamp":"2026-03-01T12:00:05.000Z"}

```

## Task Routes
- `GET /tasks/active`
- `POST /tasks/create`
- `GET /tasks/:id`
- `POST /tasks/:id/update`
- `POST /tasks/:id/delete`
- `POST /tasks/:id/run`
- `POST /tasks/:id/triggers/add`
- `POST /tasks/:id/triggers/remove`

Create body:
```json
{
    "title": "Morning report",
    "code": "print('generate report')",
    "description": "Daily report",
    "parameters": [
        { "name": "team", "type": "string", "nullable": false }
    ]
}
```

Run body:
```json
{
    "agentId": "optional-agent-id",
    "parameters": { "team": "core" },
    "sync": true
}
```

Trigger add body:
```json
{
    "type": "cron",
    "schedule": "0 9 * * 1-5",
    "timezone": "America/New_York",
    "agentId": "optional-agent-id",
    "parameters": { "team": "core" }
}
```

Trigger remove body:
```json
{ "type": "cron" }
```

## Skills Routes
- `GET /skills`
- `GET /skills/:id/content`
- `GET /skills/:id/versions`
- `POST /skills/eject`

`GET /skills` response (example):
```json
{
    "ok": true,
    "skills": [
        {
            "id": "user:my-skill",
            "name": "My Skill",
            "category": "research",
            "description": "Custom helper",
            "sandbox": true,
            "permissions": ["@read:/tmp"],
            "source": "user"
        }
    ]
}
```

`GET /skills/:id/content` response:
```json
{
    "ok": true,
    "skill": {
        "id": "user:my-skill",
        "name": "My Skill",
        "description": "Custom helper"
    },
    "content": "# My Skill\n..."
}
```

`GET /skills/:id/versions` response:
```json
{
    "ok": true,
    "skillId": "user:my-skill",
    "skillName": "my-skill",
    "currentVersion": 3,
    "previousVersions": [
        { "version": 1, "updatedAt": 1741800000000 },
        { "version": 2, "updatedAt": 1741803600000 }
    ]
}
```

`POST /skills/eject` body:
```json
{
    "name": "my-skill",
    "path": "/Users/me/workspace/exports",
    "version": 2
}
```

## Swarm Secret Routes
- `GET /swarms/:nametag/secrets`
- `POST /swarms/:nametag/secrets/copy`
- `POST /swarms/:nametag/secrets/create`
- `POST /swarms/:nametag/secrets/:name/update`
- `POST /swarms/:nametag/secrets/:name/delete`

`POST /swarms/:nametag/secrets/copy` body:
```json
{
    "secret": "openai-key"
}
```

## Vault Routes
- `GET /vault/tree`
- `GET /vault/:id`
- `GET /vault/:id/history`
- `POST /vault/create`
- `POST /vault/:id/update`
- `POST /vault/:id/delete`

## Prompt Routes
- `GET /prompts`
- `GET /prompts/:filename`
- `PUT /prompts/:filename`

Allowed prompt filenames: `SOUL.md`, `USER.md`, `AGENTS.md`, `TOOLS.md`.
`PUT /prompts/:filename` is a legacy compatibility route.

## Costs Routes
- `GET /costs/token-stats?from=<ms>&to=<ms>&agentId=<id>&model=<name>&limit=<n>`

Costs rows are always scoped to the authenticated `ctx.userId`.

```mermaid
flowchart LR
    A[Bearer token] --> B[ctx.userId]
    B --> C[tokenStats.findMany(ctx, options)]
    C --> D[/costs/token-stats rows]
```

## Key-Value Routes
- `GET /kv`
- `GET /kv/:key`
- `POST /kv/create`
- `POST /kv/:key/update`
- `POST /kv/:key/delete`

Entries are always scoped to authenticated `ctx.userId`. Values are stored as untyped JSON.

## Public Webhook Route
- `POST /v1/webhooks/:token`

This route is token-authenticated via the signed path token and does not require Bearer auth.
