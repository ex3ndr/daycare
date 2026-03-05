# NO_MESSAGE Text-Only Suppression

## Summary

`NO_MESSAGE` suppresses user-visible text from that specific assistant record only.

Everything else in the turn continues normally:

- run_python execution
- tool calls
- deferred payload flush/side effects
- history persistence
- assistant content record remains unchanged (no text block stripping)

## Flow

```mermaid
flowchart TD
    A[Assistant response record] --> B{Text is NO_MESSAGE?}
    B -- No --> C[Send assistant text normally]
    B -- Yes --> D[Suppress this record text]
    D --> E[Keep tool calls and deferred flush unchanged]
    E --> F[Persist history and continue loop]
```
