# App Chats List API

## Summary

Added a read endpoint to list app chat sessions:

- `GET /agents/chats`
- Returns only agents with `kind: "app"` for the authenticated user
- Sorted by `updatedAt` descending

Response shape:

- `ok: true`
- `chats: Array<{ agentId, name, description, lifecycle, createdAt, updatedAt }>`

## Flow

```mermaid
flowchart LR
  A[Client GET /agents/chats] --> B[agentsRouteHandle]
  B --> C[agentsChats]
  C --> D[agentCallbacks.agentList(ctx)]
  D --> E[Filter kind=app and user scope]
  E --> F[Sort by updatedAt desc]
  F --> G[Return chats payload]
```
