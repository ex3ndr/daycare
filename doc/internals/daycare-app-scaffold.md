# Daycare App Scaffold

Implemented scaffold for a new Expo app package and matching runtime plugin.

## Runtime integration

```mermaid
flowchart LR
    User[User sends /app] --> Command[/app slash command]
    Command --> Plugin[daycare-app-server]
    Plugin --> JWT[Sign token userId + exp]
    JWT --> Link[http://host:port/auth?token=...]
    Link --> App[Daycare Expo app]
    App --> Validate[POST /auth/validate]
    Validate --> Plugin
    Plugin --> Shell[Authenticated 3-pane shell]
```

## Plugin request routing

```mermaid
flowchart TD
    Request[HTTP request] --> AuthValidate{/auth/validate?}
    AuthValidate -->|yes| Validate[JWT verify]
    AuthValidate -->|no| AuthRefresh{/auth/refresh?}
    AuthRefresh -->|yes| Refresh[JWT verify + reissue]
    AuthRefresh -->|no| Api{/api/*?}
    Api -->|yes| Proxy[Proxy to engine socket]
    Api -->|no| Static[Serve app static files]
```

## App shell layout behavior

```mermaid
flowchart LR
    XS[width < 800] --> Single[Single pane]
    LG[800 <= width < 1200] --> Semi[Two panes + right drawer]
    XL[width >= 1200] --> Wide[Three side-by-side panes]
```

## CLI link generation

`daycare app-link <userId>` now generates the same magic link URL format used by `/app` and `app_auth_link`.

```mermaid
flowchart LR
    CLI[daycare app-link userId] --> Settings[Load settings.json]
    Settings --> PluginSettings[Resolve daycare-app-server host/port/jwtSecret]
    PluginSettings --> Secret[Resolve/generate app-auth.jwtSecret in auth store]
    Secret --> Sign[Sign token userId + exp]
    Sign --> URL[Print http://host:port/auth?token=...]
```

## Token stack

App link tokens are signed and verified via `privacy-kit` ephemeral tokens (Ed25519 signatures, service-scoped seed derivation).

```mermaid
flowchart LR
    Seed[auth secret seed] --> Generator[privacy-kit createEphemeralTokenGenerator]
    Generator --> Token[Signed token with exp]
    Token --> Verifier[privacy-kit createEphemeralTokenVerifier]
    Verifier --> UserId[Resolved user id]
```
