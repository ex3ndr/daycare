# System Memory Compactor Automation

Daycare now provisions memory maintenance as a reserved persisted automation instead of an ad-hoc background agent.

## What Exists

- `doc://system/memory` is the shared memory-guidance folder, with `agent`, `search`, and `compactor` child prompt documents.
- `system:memory-compactor` is a reserved persisted task that triggers memory compaction work.
- `system:<userId>:memory-compactor` is a reserved cron trigger that runs every 12 hours.
- The trigger targets a reserved compactor agent path so the run can maintain `doc://memory/*` and update `doc://system/memory/agent` plus `doc://system/memory/compactor`.

## Startup Reconciliation

- On engine startup, Daycare ensures the task exists for memory-enabled users.
- If the bundled task definition changes, the persisted system task is refreshed.
- The system cron is created or updated to point at the reserved compactor agent.
- If workspace memory is disabled, the system cron is disabled instead of deleted.

## Mutability Rules

- System tasks cannot be updated or deleted through task mutation APIs.
- System triggers cannot be added or removed manually.
- Cron triggers can still be enabled or disabled through trigger update APIs.

```mermaid
flowchart TD
    A[Engine.start] --> B[userDocumentsEnsure]
    A --> C[agentSystem.load]
    C --> D[taskSystemMemoryCompactorEnsure]
    D --> E[Ensure doc://system/memory folder and child prompts exist]
    D --> F[Ensure system:memory-compactor task]
    D --> G[Ensure system:<userId>:memory-compactor cron]
    G --> H[Reserved compactor agent path]
    H --> I[Task runs every 12 hours]
    I --> J[now tool resolves current time]
    J --> K[Check recent memory/system-memory changes]
    K --> L[Build maintenance prompt]
    L --> M[step(prompt) on current compactor agent]
    M --> N[context_compact()]
    N --> O[skip()]
    M --> P[Update doc://system/memory/compactor when compaction policy changes]
    M --> Q[Update doc://system/memory/agent when agent policy changes]
```

- The memory compactor task reads current time through the `now` tool, which returns structured unix and localized time data using the user's profile timezone when available.
- The memory compactor task reads `doc://memory` and `doc://system/memory` through the structured `document_tree` tool so it can inspect real `updatedAt` values across the full memory subtree and memory-prompt folder.
- `document_tree` returns `parentDocumentId: null` for root entries so Monty receives a structured object instead of falling back to summary text.
- The task also reads `doc://system/memory/agent` and `doc://system/memory/compactor` directly and inlines their current contents into the generated compactor prompt before calling `step(...)`.
- The package build copies `sources/system-tasks` into `dist/system-tasks`, so built installs can reconcile system tasks on startup.
