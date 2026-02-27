# API Root Welcome Message

The engine IPC API now has an explicit root route (`GET /`) that returns plain text:

```
Welcome to Daycare API!
```

This avoids returning Fastify's default placeholder response and prevents accidentally serving web app content from the API root.

```mermaid
flowchart LR
  Client[HTTP client] --> Root[GET /]
  Root --> Api[engine.ipc.server]
  Api --> Text[text/plain: Welcome to Daycare API!]
```

