# Daycare Identity

This change aligns project naming, package naming, runtime paths, and environment variables to the Daycare identity.

```mermaid
flowchart LR
  A[Daycare project] --> B[CLI command: daycare]
  A --> C[Core package: packages/daycare]
  A --> D[Dashboard package: packages/daycare-dashboard]
  A --> E[Config directory: .daycare]
  A --> F[Engine socket: daycare.sock]
  A --> G[Environment prefix: DAYCARE_*]
```

## Notes

- Workspace scripts use `daycare` and `daycare-dashboard`.
- Runtime defaults use `.daycare` and `daycare.sock`.
- Logging defaults use the `daycare` service name.

## Prompt Alias Cleanup

```mermaid
flowchart LR
  A[Prompt identity alias] --> B[Daycare]
  A1[OtterBot in SYSTEM prompts] --> B
```

- Prompt identity strings in `SYSTEM.md` and `SYSTEM_BACKGROUND.md` now use `Daycare`.
