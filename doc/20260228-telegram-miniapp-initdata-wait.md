# Fix Telegram Mini App Home Auth Bootstrap

Date: 2026-02-28

## Summary
- Fixed Telegram Mini App home-open auth flow when `WebApp.initData` is injected after initial app bootstrap.
- Updated app bootstrap session resolver to wait briefly for Telegram `initData` before giving up.
- Added regression test for delayed `initData` arrival.

## Flow
```mermaid
sequenceDiagram
    participant T as Telegram Mini App
    participant A as daycare-app bootstrap
    participant S as /auth/telegram

    T->>A: Open /?backend=...&telegramInstanceId=...
    A->>A: Parse backend + instanceId
    A->>A: Poll for WebApp.initData (<= 1.5s)
    T-->>A: initData becomes available
    A->>S: POST /auth/telegram (initData, telegramInstanceId)
    S-->>A: session token
    A->>A: Store authenticated session
```

## Files
- `packages/daycare-app/sources/modules/auth/authTelegramSessionResolve.ts`
- `packages/daycare-app/sources/modules/auth/authTelegramSessionResolve.spec.ts`
