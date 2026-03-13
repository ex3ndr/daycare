# Document Root Prompt Routing

## Summary

- Shared prompts now steer general agents toward `vault://vault/*` for durable working notes.
- `vault://memory/*` remains described as a vault path, but shared prompts now treat it as reserved for dedicated memory-agent writes.
- Supervisor bootstrap guidance now tells agents to create bootstrap entries under `vault://vault`.

## Flow

```mermaid
flowchart TD
    A[General agent learns durable fact] --> B{Is this a memory-agent-only task?}
    B -- no --> C[Write under vault://vault/*]
    B -- yes --> D[Use dedicated memory agent]
    D --> E[Write under vault://memory/*]
    C --> F[User-facing working notes stay in the shared vault root]
```
