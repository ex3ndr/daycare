# Better Auth Email Magic Link

This change adds Better Auth powered email magic-link sign-in for the Daycare app while preserving the existing Daycare JWT session model for authenticated API access.

## Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Daycare App
    participant API as App Server
    participant BA as Better Auth
    participant SMTP as SMTP Server
    participant DB as Daycare DB

    User->>App: Enter email
    App->>API: POST /auth/email/request
    API->>BA: signInMagicLink(email)
    BA->>DB: Store verification token
    API->>SMTP: Send email with /verify payload link
    SMTP-->>User: Magic link email
    User->>App: Open emailed /verify link
    App->>API: POST /auth/email/verify(token)
    API->>BA: magicLinkVerify(token)
    BA->>DB: Create auth user/session
    API->>DB: Resolve or create Daycare user via email:<address>
    API-->>App: Daycare JWT session token
    App->>API: Authenticated Bearer requests
```

## Config

Add SMTP settings under top-level `email`:

```json
{
    "email": {
        "smtpUrl": "smtp://user:pass@mail.example.com:587",
        "from": "Daycare <no-reply@example.com>",
        "replyTo": "support@example.com"
    },
    "appServer": {
        "enabled": true,
        "host": "127.0.0.1",
        "port": 7332,
        "appEndpoint": "https://app.example.com",
        "serverEndpoint": "https://api.example.com"
    }
}
```

## Notes

- Better Auth data is stored in dedicated `app_auth_*` tables inside the main Daycare database.
- Verified email identities map into Daycare users through the existing `user_connector_keys` table using `email:<normalized-address>`.
- Existing Telegram auth and signed `/app` links continue to work.

## Connect Existing Account Email

Authenticated users can also connect an email address to their existing Daycare account from Settings. That flow uses a short-lived Daycare JWT link and adds the `email:<normalized-address>` connector key only after the emailed link is opened.

```mermaid
sequenceDiagram
    participant User
    participant App as Daycare App
    participant API as App Server
    participant SMTP as SMTP Server
    participant DB as Daycare DB

    User->>App: Enter email in Settings
    App->>API: POST /profile/email/connect/request
    API->>SMTP: Send connect-email /verify link
    SMTP-->>User: Email connection link
    User->>App: Open emailed /verify link
    App->>API: POST /auth/email/connect/verify(token)
    API->>DB: Add user_connector_keys(email:<address>)
    API-->>App: Connected email + userId
```

## Dedicated Verify Route

Email and app verification links now land on a top-level `/verify` screen instead of a protected auth-group route. That keeps the confirmation screen reachable regardless of whether the user is signed out, already signed in, or switching accounts.

```mermaid
flowchart LR
    A[User opens /verify#payload] --> B[Top-level verify screen renders]
    B --> C[User presses Enter]
    C --> D{Payload kind}
    D -- email --> E[POST /auth/email/verify]
    D -- connect-email --> F[POST /auth/email/connect/verify]
    D -- session --> G[Validate session token]
    E --> H[Login and redirect to /(app)]
    F --> I[Refresh profile or show success]
    G --> H
```

## Local Env Wiring

`yarn env <name>` must wire both the API process and the web app to the same local app-server endpoints. The API side now writes top-level `appServer` settings, and the web side exports the same URL through the default backend env vars that the welcome screen reads before login.

```mermaid
flowchart LR
    A[yarn env emailcheck] --> B[scripts/envServiceApi.mjs]
    A --> C[scripts/envServiceApp.mjs]
    B --> D[settings.json appServer + email]
    C --> E[EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL=http://api.<env>.localhost:<port>]
    D --> F[Local app server]
    E --> G[Welcome screen authEmailRequest]
    G --> F
```
