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
    API->>SMTP: Send email with /auth payload link
    SMTP-->>User: Magic link email
    User->>App: Open emailed /auth link
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
    API->>SMTP: Send connect-email /auth link
    SMTP-->>User: Email connection link
    User->>App: Open emailed /auth link
    App->>API: POST /auth/email/connect/verify(token)
    API->>DB: Add user_connector_keys(email:<address>)
    API-->>App: Connected email + userId
```

## Authenticated Connect Link Handling

When a signed-in user opens a `connect-email` link, the app must keep the `/auth` route group available long enough for the verification screen to run. Otherwise Expo Router will immediately redirect back into the protected app shell and skip `POST /auth/email/connect/verify`.

```mermaid
flowchart LR
    A[Signed-in user opens /auth#connect-email payload] --> B{Auth routes still accessible?}
    B -- No --> C[Router redirects to /(app)]
    C --> D[Verification skipped]
    B -- Yes --> E[Auth screen renders]
    E --> F[User presses Enter]
    F --> G[POST /auth/email/connect/verify]
    G --> H[Profile refresh shows connected email]
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
