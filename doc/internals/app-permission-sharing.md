# App Permission Sharing

App permission grants now support app-scoped persistence so app agents can reuse
approved access across invocations.

## Scope model

- `scope: "now"` keeps the grant on the current app agent only.
- `scope: "always"` persists the grant to app-level state and applies it to all
  loaded agents for that app id.
- User-facing prompts render these scopes as:
  - `One time` for `now`
  - `Always` for `always`

## request_permission payload

For app agents, `request_permission` supports explicit scope selection:

- `scope: "now"`: one-time grant for the current app run.
- `scope: "always"`: persist the approved grant for future runs of the same app.

```mermaid
flowchart TD
  A[App calls request_permission] --> B{scope}
  B -->|now| C[Grant current app agent only]
  B -->|always| D[Persist to apps/<app-id>/state.json]
  D --> E[Apply to loaded app agents with same appId]
```

## Persistence

Shared app grants are stored at:

- `<workspace>/apps/<app-id>/state.json`

The file stores normalized permission tags (`@network`, `@read:...`,
`@write:...`) and `updatedAt`.

## Runtime flow

```mermaid
sequenceDiagram
  participant AppAgent as App Agent
  participant Tool as request_permission
  participant User as User Decision
  participant System as AgentSystem
  participant AppState as apps/<app-id>/state.json

  AppAgent->>Tool: request_permission(scope=always)
  Tool->>User: permission prompt
  User-->>Tool: approve
  Tool->>System: grantAppPermission(appId, access)
  System->>AppState: merge + persist permission tag
  System->>System: apply permission to loaded app agents (same appId)
```

## App invocation startup

```mermaid
flowchart TD
  A[app_<id> invocation] --> B[appPermissionBuild]
  B --> C[base app sandbox permissions]
  B --> D[read apps/<app-id>/state.json]
  D --> E[parse permission tags]
  E --> F[apply shared tags]
  C --> F
  F --> G[agent state permissions for this run]
```
