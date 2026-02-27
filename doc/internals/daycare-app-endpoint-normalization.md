# Daycare App Endpoint Normalization

`appEndpoint` and `serverDomain` are treated as endpoint URLs (not bare domains).

- Accepts only absolute `http://` or `https://` endpoints.
- Removes trailing slash when provided.
- Rejects paths, query strings, and hash fragments.
- Defaults `appEndpoint` to `https://daycare.dev` when not configured.

This normalization is applied in both app-link CLI option resolution and app auth link URL generation.

```mermaid
flowchart TD
  Input[appEndpoint/serverDomain input] --> Trim[trim whitespace]
  Trim --> Parse{valid absolute URL?}
  Parse -->|no| Error[throw validation error]
  Parse -->|yes| Scheme{http or https?}
  Scheme -->|no| Error
  Scheme -->|yes| Shape{path/query/hash present?}
  Shape -->|yes| Error
  Shape -->|no| Out[normalized origin without trailing slash]
```
