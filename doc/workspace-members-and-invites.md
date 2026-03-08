# Workspace Members and Invites

Daycare workspaces now support explicit membership rows and reusable invite links.

## What Changed

- Shared workspace access is no longer owner-only.
- Active members are stored in `workspace_members`.
- Invite links are short-lived JWT-backed app URLs that open the `/invite` screen.
- Joined workspaces are included in the app workspace switcher.
- Kicked members lose `GET /w/:workspaceId/...` access immediately and cannot rejoin with the same workspace invite flow.

## Access Resolution

```mermaid
flowchart TD
  A[Request /w/:workspaceId/*] --> B{caller == workspaceId}
  B -->|yes| C[Allow self workspace scope]
  B -->|no| D[Load target user]
  D --> E{target is workspace and workspaceOwnerId == caller}
  E -->|yes| F[Allow owner access]
  E -->|no| G{active workspace_members row exists}
  G -->|yes| H[Allow member access]
  G -->|no| I[Deny with Workspace access denied]
```

## Invite Flow

```mermaid
sequenceDiagram
  participant Owner
  participant API
  participant Invitee
  participant App

  Owner->>API: POST /workspaces/:nametag/invite/create
  API-->>Owner: { url, token, expiresAt }
  Owner->>Invitee: Share invite URL
  Invitee->>App: Open /invite#payload
  App->>App: Persist redirect target and send unauthenticated user to sign-in
  Invitee->>App: Complete auth
  App->>App: Return to /invite
  Invitee->>App: Confirm join
  App->>API: POST /invite/accept { token }
  API->>API: Verify JWT + workspace + membership state
  API-->>App: { ok: true, workspaceId }
  App->>API: GET /workspaces
  App->>App: Navigate to /:workspaceId/home
```
