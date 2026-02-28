# Webhook Triggers

Webhook triggers add a third task trigger mode (with cron and heartbeat).
Each webhook trigger is a cuid2 id used as both identifier and secret.

## What Was Added

- `tasks_webhook` storage table and migration (`20260227_webhook_triggers.sql`)
- `WebhookTasksRepository` for CRUD + caching
- `Webhooks` facade for trigger creation, listing, deletion, and execution
- `task_trigger_add` / `task_trigger_remove` support for `type: "webhook"`
- `task_read` output now includes webhook trigger URLs (full endpoint URL)
- `task_create` supports `webhook: true`
- `task_delete` removes webhook triggers
- App server route:
  - `POST /v1/webhooks/:id`

## Data Model

```mermaid
erDiagram
    TASKS {
        text id PK
        text user_id
        text title
        text code
    }

    TASKS_WEBHOOK {
        text id PK
        text task_id FK
        text user_id FK
        text agent_id
        bigint created_at
        bigint updated_at
    }

    TASKS ||--o{ TASKS_WEBHOOK : "triggered by"
```

## Trigger Execution Flow

```mermaid
flowchart LR
    A[External caller] --> B[POST /v1/webhooks/:id]
    B --> C[Webhooks.trigger(id, body)]
    C --> D[Lookup tasks_webhook by id]
    D --> E[Lookup task by taskId + userId]
    E --> F[agentSystem.postAndAwait]
    F --> G[Run task Python code]
```

## Tool Flow

```mermaid
flowchart TD
    A[task_trigger_add type=webhook] --> B[Webhooks.addTrigger]
    B --> C[Insert tasks_webhook row]
    C --> D[Resolve app-server endpoint]
    D --> E[Return webhook id + endpoint/v1/webhooks/:id]

    F[task_trigger_remove type=webhook] --> G[Webhooks.deleteTriggersForTask]
    G --> H[Delete matching tasks_webhook rows]
```
