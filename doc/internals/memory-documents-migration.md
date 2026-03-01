# Memory to Documents Migration

Memory storage is now backed by `documents` instead of markdown graph files.

## Runtime Flow

```mermaid
sequenceDiagram
    participant A as Agent Session
    participant MW as MemoryWorker
    participant DR as DocumentsRepository
    participant MA as Memory-Agent

    A->>MW: Session invalidated
    MW->>DR: ensure ~/memory root document
    MW->>MA: Post transcript system_message
    MA->>DR: document_read(path="~/memory")
    MA->>DR: document_write(...) for new/updated facts
```

## Tool Surface

```mermaid
graph TD
    AllAgents[All agents] --> document_read
    AllAgents --> document_write
    AllAgents --> document_search

    MemoryAgent[memory-agent] -->|allowlist| document_read
    MemoryAgent -->|allowlist| document_write

    MemorySearch[memory-search] -->|allowlist| document_read
    MemorySearch -->|allowlist| send_agent_message
```

## Removed Components

- `engine/memory/graph/*`
- `engine/memory/memory.ts` (`Memory` facade)
- Legacy tools:
  - `memory_node_read`
  - `memory_node_write`
  - `search_memory`

## Added Components

- `document_read`
- `document_write`
- `document_search`
- `memoryRootDocumentEnsure()` for `~/memory` bootstrap

