# Daycare App Hash Link Auth

The app auth link now carries backend configuration in the URL hash so the web app is backend-agnostic at runtime.

- Link format changed from query token to hash payload.
- Hash payload is URL-safe base64 JSON with `backendUrl` and `token`.
- Link token is ephemeral (default: 1 hour) and exchanged on `/auth` to a long-lived session token.
- Auth screen now shows server details and requires explicit `Enter` before validation.
- Stored auth session now persists `{ baseUrl, token }` together.

```mermaid
sequenceDiagram
    participant User as User
    participant Runtime as daycare-app-server
    participant App as Daycare App

    Runtime-->>User: /auth#base64url({backendUrl,token})
    User->>App: Open link
    App->>App: Decode hash payload
    App-->>User: Welcome + server info + Enter
    User->>App: Tap Enter
    App->>Runtime: POST backendUrl/auth/validate { linkToken }
    Runtime-->>Runtime: Verify ephemeral link token
    Runtime-->>Runtime: Sign 1-year session token
    Runtime-->>App: { ok, userId, token: sessionToken }
```
