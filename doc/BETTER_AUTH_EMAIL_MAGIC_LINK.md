# Email Auth Codes

This change replaces email magic-link sign-in with six-digit email codes while keeping the existing Daycare JWT session model for authenticated API access.

## Sign-In Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Daycare App
    participant API as App Server
    participant Memory as In-Memory Pending Codes
    participant SMTP as SMTP Server
    participant DB as Daycare DB

    User->>App: Enter email
    App->>API: POST /auth/email/request
    API->>Memory: Create one active code for email
    API->>SMTP: Send 6-digit code
    SMTP-->>User: Code email
    User->>App: Enter code
    App->>API: POST /auth/email/verify {email, code}
    API->>Memory: Verify hash, TTL, attempts
    API->>DB: Resolve or create Daycare user via email:<address>
    API-->>App: Daycare JWT session token
    App->>API: Authenticated Bearer requests
```

## Challenge State

Pending email codes live only in app-server memory. Each email address has at most one active code.

```mermaid
flowchart TD
    A[POST /auth/email/request] --> B{Existing active code?}
    B -- resend too soon --> C[Reject with retry message]
    B -- allowed --> D[Generate 6-digit code]
    D --> E[Hash code with server secret + salt]
    E --> F[Store email challenge in memory]
    F --> G[Send email]

    H[POST /auth/email/verify] --> I{Challenge exists and not expired?}
    I -- no --> J[Reject]
    I -- yes --> K{Attempts remaining?}
    K -- no --> J
    K -- yes --> L{Hash matches?}
    L -- no --> M[Increment failed attempts]
    L -- yes --> N[Delete challenge]
    N --> O[Issue session token]
```

## Security Notes

- Codes are always six digits and never start with `0`.
- Pending codes are stored hashed in memory, not in the database and not as plaintext.
- Only one code stays active per email; a new request replaces the prior code.
- Verification enforces expiration, resend throttling, and bounded failed attempts.
- Server restarts clear pending codes, so users must request a new code after a restart.

## Connect Existing Account Email

Authenticated users still connect additional emails through a short-lived `/verify` link because that flow links an address to an already-authenticated account rather than signing in.

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
