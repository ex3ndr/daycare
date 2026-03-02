# Remove agents.tokens column

## Summary
- Removed `tokens` from the `agents` table schema.
- Removed `tokens` from storage row types and agent repository persistence logic.
- Updated bootstrap migration SQL and affected tests.

## Data model flow
```mermaid
flowchart LR
    Schema[schema.ts agentsTable] --> Repo[AgentsRepository mappings]
    Repo --> Storage[Storage createAgentWithSession]
    Storage --> SQL[bootstrap migration SQL]
```

## Result
```mermaid
flowchart TD
    Before[agents table had tokens jsonb] --> After[agents table has no tokens column]
    After --> Runtime[context usage derived from history/message estimates]
```
