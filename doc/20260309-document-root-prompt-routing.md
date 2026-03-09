# Document Root Prompt Routing

## Summary

- Shared prompts now steer general agents toward `doc://document/*` for durable working notes.
- `doc://memory/*` remains described as a document-store path, but shared prompts now treat it as reserved for dedicated memory-agent writes.
- Supervisor bootstrap guidance now tells agents to create bootstrap documents under `doc://document`.

## Flow

```mermaid
flowchart TD
    A[General agent learns durable fact] --> B{Is this a memory-agent-only task?}
    B -- no --> C[Write under doc://document/*]
    B -- yes --> D[Use dedicated memory agent]
    D --> E[Write under doc://memory/*]
    C --> F[User-facing working docs stay in shared document root]
```
