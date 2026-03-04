# App Chat Component Extraction

## Summary

Extracted reusable chat UI/state from `views/agents` + `modules/agents` into a standalone `modules/chat` module.

Key changes:

- Added `Chat.tsx` for controlled (`agentId`) and auto-create (`systemPrompt`) modes.
- Added `chatApi.ts` for create/history/send/poll API operations.
- Added global keyed chat Zustand store in `chatStoreCreate.ts` with `open/create/send/poll`.
- Moved chat UI pieces to `modules/chat`:
  - `ChatInput.tsx`
  - `ChatMessageList.tsx`
  - `ChatMessageItem.tsx`
  - `chatHistoryTypes.ts`
  - `chatMessageItemHelpers.ts`
- Rewired `AgentDetailView` to render `<Chat agentId={agentId} />`.
- Simplified `agentsStoreCreate.ts` to list-fetch responsibilities only.
- Removed deprecated agent chat files:
  - `agentsHistoryFetch.ts`
  - `agentsMessageSend.ts`
  - `agentsMessage.ts`

## Runtime Flow

```mermaid
flowchart TD
  A[Chat props] --> B{agentId provided?}
  B -- yes --> C[store.open baseUrl token agentId]
  B -- no --> D{systemPrompt provided?}
  D -- yes --> E[store.create baseUrl token prompt]
  E --> F[resolve created agentId]
  D -- no --> G[show configuration error]

  C --> H[session history loaded]
  F --> H
  H --> I[render ChatMessageList + ChatInput]
  I --> J[store.send on input submit]
  J --> K[chatMessageSend API]
  K --> L[chatMessagesPoll after lastPollAt]
  L --> M[append records to keyed session]

  H --> N[poll loop every 3s]
  N --> O[store.poll]
  O --> L
```

## State Shape

```mermaid
flowchart LR
  S[chat store] --> K1["sessions[agent-1]"]
  S --> K2["sessions[agent-2]"]
  K1 --> H1[history]
  K1 --> P1[lastPollAt]
  K2 --> H2[history]
  K2 --> P2[lastPollAt]
```
