# Database URL Env Override

## Summary
- Added `DATABASE_URL` as a runtime fallback for `settings.engine.db.url`.
- Added `SMTP_URL` as a runtime fallback for `settings.email.smtpUrl`.
- Kept the settings file authoritative when it already provides a non-empty `engine.db.url`.
- Kept the settings file authoritative when it already provides a non-empty `email.smtpUrl`.
- Applied both fallbacks in `readSettingsFile()` and `configLoad()` so file-backed commands and normal startup follow the same rule.

## Resolution Flow

```mermaid
flowchart TD
    A[Read settings.json if present] --> B[Parse and normalize settings]
    B --> C{settings.engine.db.url set?}
    C -->|yes| D[Keep file db url]
    C -->|no| E{DATABASE_URL set?}
    E -->|yes| F[Use env database url]
    E -->|no| G[Use default pglite path]
    B --> I{settings.email.smtpUrl set?}
    I -->|yes| J[Keep file smtp url]
    I -->|no| K{SMTP_URL set?}
    K -->|yes| L[Use env smtp url]
    K -->|no| M[Leave smtp unset]
    D --> H[Resolve config db target]
    F --> H
    G --> H
```
