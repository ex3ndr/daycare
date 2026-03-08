# Per-User Prompt Migration

Historical note: this migration was removed from engine startup on 2026-03-08 after all environments had been migrated.

Legacy prompt migration now imports from each user's own filesystem home instead of only the owner user's home.

## What Changed

- The historical startup migration loaded all users after resolving the owner record
- For each user, it ensures that user's `doc://system/*` documents exist
- It imports legacy prompt files from `<usersDir>/<userId>/home/knowledge/{SOUL,USER,AGENTS,TOOLS}.md`
- The old global `config.dataDir/*.md` files remain only as a fallback for the owner user

## Why

The previous migration assumed legacy prompt files only existed in the owner user's home. That breaks when workspace users or other non-owner users already have their own home directories and their own prompt files.

## Flow

```mermaid
flowchart TD
    A[Historical engine start] --> B[Resolve or create owner user]
    B --> C[Load all users]
    C --> D{For each user}
    D --> E[Ensure UserHome]
    E --> F[Ensure doc://system/{soul,user,agents,tools}]
    F --> G[Read that user's home/knowledge/*.md]
    G --> H[Owner only: fall back to config.dataDir/*.md]
    H --> I[Write imported content into that user's documents]
    I --> J[Write global migration marker]
```
