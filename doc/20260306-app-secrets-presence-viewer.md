# App Secrets Presence Viewer

## Summary
- Adds a secrets section to app settings.
- Uses the existing metadata-only secrets API so the UI can show which secrets exist without rendering any secret values.

## Flow
```mermaid
flowchart TD
    A[SettingsView mounts] --> B{baseUrl and token available}
    B -- no --> C[Skip secrets fetch]
    B -- yes --> D[GET /secrets metadata endpoint]
    D --> E{Response}
    E -- success --> F[Sort secret summaries]
    F --> G[Render names, descriptions, variable names, and counts]
    E -- empty --> H[Render no secrets saved state]
    E -- failure --> I[Render secrets unavailable state]
    G --> J[Footer reminds that secret values are never displayed]
    H --> J
    I --> J
```
