# Validation Session Isolation

Provider and model validation now uses a fresh inference session id for every check.

This avoids sticky backend session state when a provider transport treats `sessionId` as reusable context, which was causing validation runs to behave as if they were still on a previous default or previously tested model.

```mermaid
flowchart TD
    A[Validation command starts] --> B[Create unique validation session id]
    B --> C[Build provider override for requested model]
    C --> D[Run one-shot inference check]
    D --> E[Dispose validation instance]
    E --> F[Next validation gets a new session id]
```
