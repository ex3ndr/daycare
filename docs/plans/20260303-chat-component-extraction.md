# Extract Reusable Chat Component

## Overview
Extract chat UI and state management from the agents module into a standalone, reusable `chat/` module in `packages/daycare-app`. The component can be embedded anywhere in the app with a single `<Chat agentId={id} />` call. When `agentId` is omitted, the component auto-creates a new app agent via the existing `POST /agents/create` API.

**End result:** A pluggable `<Chat />` component that any screen in the app can import and embed. A single global Zustand store manages all chat sessions keyed by `agentId`, so multiple chats can coexist without state conflicts.

**Key outcomes:**
- Chat UI is decoupled from the agents list/detail navigation flow
- Multiple chat instances can coexist on different screens — global store keyed by agentId
- Auto-creation mode: `<Chat systemPrompt="..." />` creates a session on mount
- Controlled mode: `<Chat agentId="abc123" />` connects to an existing agent
- Incremental polling via `GET /agents/:id/messages?after=<ts>` for near-real-time updates
- All existing agent detail view functionality preserved

## Context
- **Current state:** Chat UI lives in `sources/views/agents/` (AgentDetailView, AgentInput, AgentMessageList, AgentMessageItem) and state lives in `sources/modules/agents/` (agentsStoreCreate with shared history/sendMessage). The global agents store holds a single `history` array — only one chat can be viewed at a time.
- **API endpoints (unchanged):**
  - `POST /agents/create` — creates app agent with `{ systemPrompt, name?, description? }`
  - `GET /agents/:id/history` — fetches full history records
  - `GET /agents/:id/messages?after=<ts>` — polls for new messages since timestamp
  - `POST /agents/:id/message` — sends a message
  - `POST /agents/:id/delete` — kills agent
- **Types:** `AgentHistoryRecord` discriminated union in `agentHistoryTypes.ts` — used directly, no re-aliasing

## Development Approach
- **Testing approach**: Code first, then tests
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility — existing AgentsView and AgentDetailView must keep working

## Testing Strategy
- **Unit tests**: Required for every task — API functions, store logic, helper functions
- Tests live next to the file under test as `*.spec.ts`

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- ⚠️ Implemented `sessions` as `Record<string, ChatSessionState>` instead of `Map` to align with the keyed-session design and keep selectors/simple updates ergonomic in Zustand.
- ⚠️ Dedicated React Native component tests for `Chat.tsx` and `AgentDetailView.tsx` are not runnable in this Vitest setup (`react-native` entry parsing in node test runtime); behavior is covered via API/store unit tests.

## Implementation Steps

### Task 1: Create chat API client module
- [x] Create `sources/modules/chat/chatApi.ts` with three exported functions:
  - `chatCreate(baseUrl, token, systemPrompt, name?, description?)` — calls `POST /agents/create`, returns `{ agentId, initializedAt }`
  - `chatHistoryFetch(baseUrl, token, agentId)` — calls `GET /agents/:id/history`, returns `AgentHistoryRecord[]`
  - `chatMessageSend(baseUrl, token, agentId, text)` — calls `POST /agents/:id/message`
  - `chatMessagesPoll(baseUrl, token, agentId, after)` — calls `GET /agents/:id/messages?after=<ts>`, returns `AgentHistoryRecord[]`
- [x] Write tests for all four functions in `chatApi.spec.ts` (success + error cases)
- [x] Run tests — must pass before next task

### Task 2: Create global chat Zustand store
- [x] Create `sources/modules/chat/chatStoreCreate.ts` — a single global Zustand store that manages multiple chat sessions keyed by `agentId`
- [x] State shape: `Map<agentId, ChatSessionState>` where `ChatSessionState = { agentId, history, loading, sending, error, lastPollAt }`
- [x] Action: `open(baseUrl, token, agentId)` — fetch full history for an existing agent, store under its key
- [x] Action: `create(baseUrl, token, { systemPrompt, name?, description? })` — call `chatCreate`, then fetch history, return `agentId`
- [x] Action: `send(baseUrl, token, agentId, text)` — send message, then poll for new messages (using `after=lastPollAt`)
- [x] Action: `poll(baseUrl, token, agentId)` — incremental poll via `chatMessagesPoll`, append new records to existing history
- [x] Selector helpers: `useChat(agentId)` — returns `{ history, loading, sending, error }` for a specific session
- [x] Create `sources/modules/chat/chatContext.ts` — exports `useChatStore` (the global store hook)
- [x] Write tests for store open/create/send/poll in `chatStoreCreate.spec.ts`
- [x] Run tests — must pass before next task

### Task 3: Move chat UI components
- [x] Move `views/agents/AgentMessageItem.tsx` → `modules/chat/ChatMessageItem.tsx` (rename component)
- [x] Move `views/agents/AgentMessageList.tsx` → `modules/chat/ChatMessageList.tsx` (rename component, update import of ChatMessageItem)
- [x] Move `views/agents/AgentInput.tsx` → `modules/chat/ChatInput.tsx` (rename component)
- [x] Move `views/agents/agentHistoryTypes.ts` → `modules/chat/chatHistoryTypes.ts`
- [x] Move `views/agents/agentMessageItemHelpers.ts` → `modules/chat/chatMessageItemHelpers.ts`
- [x] Move `views/agents/agentMessageItemHelpers.spec.ts` → `modules/chat/chatMessageItemHelpers.spec.ts` (update imports)
- [x] Update any remaining `views/agents/` files to import from `modules/chat/` (AgentDetailView imports)
- [x] Run tests — must pass before next task

### Task 4: Create the `<Chat />` component
- [x] Create `sources/modules/chat/Chat.tsx` — the main pluggable component
- [x] Props: `agentId?: string`, `systemPrompt?: string`, `name?: string`, `description?: string`
- [x] On mount: if `agentId` provided, call `store.open()`; if `systemPrompt` provided, call `store.create()` and store resolved `agentId` in local state
- [x] Guard against React strict mode double-mount: use abort flag / ref to prevent creating two agents
- [x] Renders: `ChatMessageList` + `ChatInput` (no header/back button — the embedder controls chrome)
- [x] Set up polling interval: call `store.poll()` every ~3s while mounted, clean up on unmount
- [x] Handle loading state (spinner while initializing/creating agent)
- [x] Handle error state (show error message)
- [x] Re-initialize when `agentId` prop changes
- [x] Run tests — must pass before next task

### Task 5: Wire AgentDetailView to use Chat component
- [x] Update `views/agents/AgentDetailView.tsx` to render `<Chat agentId={agentId} />` instead of directly using message list + input + agents store
- [x] AgentDetailView keeps its own header + back button, wrapping the Chat component
- [x] Run tests — must pass before next task

### Task 6: Clean up agents store
- [x] Remove `history`, `historyLoading`, `historyError`, `fetchHistory`, `sendMessage` from `agentsStoreCreate.ts`
- [x] Update `agentsContext.ts` if needed
- [x] Remove `agentsMessage.ts` (deprecated duplicate of `agentsMessageSend.ts`)
- [x] Remove `agentsHistoryFetch.ts` and `agentsMessageSend.ts` (superseded by `chatApi.ts`)
- [x] Run tests — must pass before next task

### Task 7: Verify acceptance criteria
- [x] Verify `<Chat agentId="..." />` works — connects to existing agent, shows history, sends messages
- [x] Verify `<Chat systemPrompt="..." />` works — creates new agent on mount, then behaves as normal chat
- [x] Verify AgentDetailView still works via navigation (agents list → agent detail)
- [x] Verify multiple Chat instances can coexist (keyed state in global store)
- [x] Run full test suite (unit tests)
- [x] Run linter — all issues must be fixed

### Task 8: [Final] Update documentation
- [x] Add brief JSDoc to `Chat.tsx` explaining usage patterns
- [x] Update this plan with any deviations that occurred

## Technical Details

### Chat component API
```typescript
// Controlled mode — connect to existing agent
<Chat agentId="agent_abc123" />

// Auto-create mode — creates a new app agent on mount
<Chat systemPrompt="You are a helpful assistant for task management." />

// With optional metadata
<Chat
    systemPrompt="You help with code review."
    name="Code Review Chat"
    description="Embedded chat for PR review"
/>
```

### Global store with keyed sessions
One global Zustand store holds all active chat sessions keyed by `agentId`. Each `<Chat />` instance selects its own slice via `useChat(agentId)`. This avoids per-instance store factories while supporting multiple concurrent chats.

```typescript
// Store shape
type ChatStore = {
    sessions: Record<string, ChatSessionState>;
    open: (baseUrl: string, token: string, agentId: string) => Promise<void>;
    create: (baseUrl: string, token: string, input: ChatCreateInput) => Promise<string>;
    send: (baseUrl: string, token: string, agentId: string, text: string) => Promise<void>;
    poll: (baseUrl: string, token: string, agentId: string) => Promise<void>;
};

type ChatSessionState = {
    agentId: string;
    history: AgentHistoryRecord[];
    loading: boolean;
    sending: boolean;
    error: string | null;
    lastPollAt: number;
};

// Usage in Chat component
function Chat({ agentId }: { agentId: string }) {
    const session = useChatStore((s) => s.sessions[agentId]);
    const send = useChatStore((s) => s.send);
    // ...
}
```

### Polling strategy
- On mount: fetch full history via `GET /agents/:id/history`
- After initial load: poll `GET /agents/:id/messages?after=<lastPollAt>` every ~3 seconds
- After sending a message: immediately poll (don't wait for interval)
- On unmount: clear interval, leave session state in store (cheap, allows instant re-mount)

### Strict mode safety for auto-create
```typescript
function Chat({ systemPrompt }: ChatProps) {
    const creatingRef = React.useRef(false);
    const [agentId, setAgentId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (creatingRef.current) return;  // guard against double-mount
        creatingRef.current = true;
        store.create(baseUrl, token, { systemPrompt }).then(setAgentId);
        // no cleanup — agent persists intentionally
    }, []);
}
```

### File structure
```
sources/modules/chat/
├── Chat.tsx                        # Main pluggable component
├── ChatInput.tsx                   # Terminal-style input (moved from views/agents/)
├── ChatMessageList.tsx             # Inverted message list (moved)
├── ChatMessageItem.tsx             # Individual message rendering (moved)
├── chatApi.ts                      # All API calls: create, fetchHistory, sendMessage, poll
├── chatApi.spec.ts
├── chatHistoryTypes.ts             # AgentHistoryRecord types (moved from views/agents/)
├── chatMessageItemHelpers.ts       # extractText, recordDisplayKind (moved)
├── chatMessageItemHelpers.spec.ts
├── chatStoreCreate.ts              # Global Zustand store for all chat sessions
├── chatStoreCreate.spec.ts
└── chatContext.ts                  # useChatStore export
```

## Post-Completion
**Manual verification:**
- Embed `<Chat systemPrompt="..." />` on a test screen to verify auto-creation flow end-to-end
- Test with real backend to verify API round-trips (create → send → poll)
- Verify two `<Chat />` instances on the same screen work independently
