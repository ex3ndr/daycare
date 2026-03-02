# Daycare App Secrets API

## Summary

Added authenticated secrets endpoints to the app API with full CRUD coverage.

- `GET /secrets`
- `GET /secrets/:name`
- `POST /secrets/create`
- `POST /secrets/:name/update`
- `POST /secrets/:name/delete`

All responses are metadata-only and never include secret variable values.

## Flow

```mermaid
sequenceDiagram
    participant App as Daycare App Client
    participant Api as AppServer /secrets routes
    participant Engine as Secrets facade
    participant File as users/<userId>/secrets.json

    App->>Api: POST /secrets/create (name, variables)
    Api->>Engine: add(ctx, secret)
    Engine->>File: write secret values
    Engine-->>Api: success
    Api-->>App: {ok:true, secret:{name, variableNames, variableCount}}

    App->>Api: GET /secrets
    Api->>Engine: list(ctx)
    Engine->>File: read full secrets
    Engine-->>Api: full secrets (with values)
    Api-->>App: metadata only (values redacted)
```
