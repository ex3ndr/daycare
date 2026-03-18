# Durable Runtime

## Summary
- Added a dedicated `sources/durable/` runtime for server mode.
- Added an engine-owned durable abstraction with `local` and `inngest` implementations.
- The durable runtime enables the `inngest` implementation only in server mode and only when both `INNGEST_ENDPOINT` and `INNGEST_TOKEN` are present in the process environment.
- It uses the official Inngest TypeScript SDK v4 `connect()` worker runtime.
- It normalizes the configured endpoint into an API base URL plus a websocket gateway URL and starts the worker in server mode.

## Flow

```mermaid
flowchart TD
    A[Engine boot] --> B{server mode?}
    B -->|no| C[use local durable runtime]
    B -->|yes| D[read INNGEST_ENDPOINT and INNGEST_TOKEN]
    D --> E{both set?}
    E -->|no| C
    E -->|yes| F[use inngest durable runtime]
    F --> G[normalize endpoint to apiUrl plus gatewayUrl]
    G --> H[start official connect worker]
    C --> I[Engine.start calls durable.start]
    H --> I
    I --> J[Engine.shutdown calls durable.stop]
```
