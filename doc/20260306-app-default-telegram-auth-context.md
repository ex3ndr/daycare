# App Default Telegram Auth Context

The app now defaults Telegram WebApp auth to the production backend and default Telegram connector id when launch parameters are omitted.

## Behavior

- Missing `backend` now resolves to `https://api.daycare.dev`.
- Missing `telegramInstanceId` now resolves to `telegram`.
- Invalid explicit backend values still fail parsing instead of silently changing targets.

```mermaid
flowchart TD
    A[Telegram WebApp opens app] --> B{initData available?}
    B -- no --> C[Abort auth]
    B -- yes --> D[Parse href and raw launch params]
    D --> E{backend provided?}
    E -- yes, valid --> F[Use provided backend]
    E -- no --> G[Use https://api.daycare.dev]
    E -- yes, invalid --> C
    F --> H{telegramInstanceId provided?}
    G --> H
    H -- yes --> I[Use provided instance id]
    H -- no --> J[Use telegram]
    I --> K[POST /auth/telegram]
    J --> K
```
