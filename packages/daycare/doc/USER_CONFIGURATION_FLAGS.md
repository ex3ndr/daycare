# User Configuration Flags

The app shell is controlled by a JSON object stored on `users.configuration`.
These flags are **workspace-scoped** — they are read from the workspace user record, not the authenticated caller.

Initial shape:

```json
{
    "homeReady": false,
    "appReady": false,
    "bootstrapStarted": false
}
```

Behavior:

- `homeReady`: switches between onboarding-style home and the real home view.
- `appReady`: controls whether navigation chrome such as sidebars is visible.
- `bootstrapStarted`: keeps workspace onboarding in its in-progress state after the initial supervisor bootstrap request.
- Missing or malformed stored values normalize back to `false`.
- `GET /config` (workspace-scoped) returns the workspace's configuration.
- `POST /w/{workspaceId}/profile/update` accepts partial `configuration` updates and merges them into the workspace value.
- `GET /events` always emits the latest workspace configuration snapshot on connect, then forwards live `user.configuration.sync` updates.

## App loading order

1. Workspace resolved from URL
2. `GET /w/{workspaceId}/config` fetched — blocks rendering until loaded
3. SSE connects to `/w/{workspaceId}/events` — receives initial config snapshot + live updates
4. `appReady` controls sidebar/chrome visibility (desktop: workspace strip + sidebar + chat panel; mobile: drawer + hamburger)
5. `homeReady` controls home route: `HomeView` when true, `OnboardingView` when false

```mermaid
sequenceDiagram
    participant Agent
    participant API as App API
    participant DB as users.configuration
    participant SSE as /events
    participant App

    App->>API: GET /w/{id}/config
    API->>DB: read workspace configuration
    API-->>App: { homeReady, appReady, bootstrapStarted }

    Agent->>API: POST /w/{id}/profile/update { configuration }
    API->>DB: versioned user row update
    API->>SSE: emit user.configuration.sync
    SSE-->>App: live configuration event
    App->>SSE: reconnect
    SSE->>DB: load latest workspace configuration
    SSE-->>App: user.configuration.sync snapshot
```
