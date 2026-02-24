# Sandbox Weaker Nested Flag

Daycare now enables `enableWeakerNestedSandbox: true` only when execution is inside Docker:

- one-shot `exec` tool commands using Docker sandbox containers
- durable managed processes when Daycare itself runs in Docker
- direct `runInSandbox` calls when Docker environment markers are detected

Non-Docker host execution omits the flag.

```mermaid
flowchart TD
  A[Tool or scheduler command] --> B{Running in Docker?}
  B -->|yes| C[set enableWeakerNestedSandbox=true]
  B -->|no| D[omit enableWeakerNestedSandbox]
  C --> E[@anthropic-ai/sandbox-runtime CLI]
  D --> E
```
