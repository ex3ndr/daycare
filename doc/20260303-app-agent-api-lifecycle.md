# App Agent API Lifecycle

## Summary

Added a first-class `app` agent kind and action-based app API routes for lifecycle management:

- `POST /agents/create` creates an app agent from a system prompt and returns `{ agentId, initializedAt }`.
- `POST /agents/:id/messages/create` queues an async message to that agent.
- `GET /agents/:id/messages?after=<unix-ms>&limit=<n>` returns history records newer than `after`.
- `POST /agents/:id/delete` kills the agent.

Runtime lifecycle now treats `app` agents like ephemeral workers for inactivity termination:

- when an `app` agent sleeps, a poison-pill signal is scheduled for one hour later.
- waking the agent cancels and reschedules that timer.
- firing the timer marks the agent dead and clears pending inbox rows.

## Flow

```mermaid
flowchart TD
  A[App Client] -->|POST /agents/create| B[App API]
  B --> C[AgentSystem.agentIdForTarget kind=app]
  C --> D[(agents + state persisted)]
  D --> E[Return agentId + initializedAt]

  A -->|POST /agents/:id/messages/create| F[Queue message]
  F --> G[Agent processes inbox asynchronously]
  G --> H[(session_history)]

  A -->|GET /agents/:id/messages?after=t| I[Filter history records at > t]
  I --> J[Return history array]

  G --> K[Sleep when idle]
  K --> L[Schedule poison-pill in 1h]
  L -->|no new work| M[Mark dead + clear inbox]

  A -->|POST /agents/:id/delete| N[AgentSystem.kill]
  N --> M
```
