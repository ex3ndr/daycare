# Durable Runtime

## Summary
- Added a dedicated `sources/durable/` runtime for server mode.
- The durable runtime enables itself only when both `INNGEST_ENDPOINT` and `INNGEST_TOKEN` are present in the process environment.
- It uses the official Inngest TypeScript SDK v4 `connect()` worker runtime.
- It normalizes the configured endpoint into an API base URL plus a websocket gateway URL and starts the worker in server mode.

## Flow

```mermaid
flowchart TD
    A[server command boot] --> B[Read INNGEST_ENDPOINT and INNGEST_TOKEN]
    B --> C{both set?}
    C -->|no| D[durable runtime disabled]
    C -->|yes| E[normalize endpoint to apiUrl plus gatewayUrl]
    E --> F[create Inngest client with signingKey token]
    F --> G[start official connect worker]
    G --> H[maintain websocket connection via SDK]
```
