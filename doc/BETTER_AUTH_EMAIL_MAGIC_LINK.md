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
