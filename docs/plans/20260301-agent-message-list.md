# Agent Message List

## Overview
Port the messaging list UI from the happy project to the daycare app's agent page. When a user taps an agent, navigate to a new screen showing that agent's message history with a text input to send new messages.

This is a **minimal** port — no markdown rendering, no autocomplete, no settings overlays, no model/permission selectors. Just a scrollable message list and a text input.

## Context
- **Source**: `~/Developer/happy/packages/happy-app/sources/components/` — `ChatList.tsx`, `MessageView.tsx`, `AgentInput.tsx`, `MultiTextInput.tsx`
- **Target**: `packages/daycare-app/sources/`
- **Backend already exists**:
  - `GET /agents/:id/history` → `AgentHistoryRecord[]` (user_message, assistant_message, rlm tool calls, notes)
  - `POST /agents/:id/message` → sends text to agent inbox
- **Data model**: `AgentHistoryRecord` is a discriminated union on `type` field with `at` (unix timestamp) on every variant
- **Routing**: Expo Router file-based, current agent page at `/agents` mode via `SidebarModeView`
- **Styling**: React Native Unistyles 3.0, Material Design 3 theme tokens
- **Existing patterns**: `ItemList`, `ItemGroup`, `Item` components for lists; Zustand stores for state

## Component Design

### Component Tree
```
AgentDetailView (new route screen)
├── Header (back button + agent name)
├── AgentMessageList (inverted FlatList)
│   └── AgentMessageItem (repeats)
│       ├── UserMessageItem (right-aligned bubble)
│       ├── AssistantMessageItem (left-aligned text)
│       └── ToolCallItem (compact one-liner)
└── AgentInput (text field + send button)
```

### New Components
| Component | File | Notes |
|-----------|------|-------|
| `AgentMessageList` | `views/agents/AgentMessageList.tsx` | Inverted FlatList of history records |
| `AgentMessageItem` | `views/agents/AgentMessageItem.tsx` | Dispatches by record type |
| `AgentInput` | `views/agents/AgentInput.tsx` | Text field + send button (ported from happy, stripped down) |
| `AgentDetailView` | `views/agents/AgentDetailView.tsx` | Full screen: header + list + input |

### Reused Components
- Unistyles theme tokens for colors/spacing
- `useAuthStore` for `baseUrl`/`token`

### Record type rendering
| `AgentHistoryRecord.type` | Rendering |
|---------------------------|-----------|
| `user_message` | Right-aligned bubble with plain text |
| `assistant_message` | Left-aligned plain text (extract text blocks from content array) |
| `rlm_tool_call` | Single line: tool name + state badge (running/completed/error) |
| `rlm_start`, `rlm_complete` | Skip (noise) |
| `assistant_rewrite` | Skip |
| `note` | Centered muted text |

## Development Approach
- **Build order**: bottom-up (message items → list → input → detail view → routing)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes
- **CRITICAL: all tests must pass before starting next task**
- Run tests after each change

## Implementation Steps

### Task 1: Create agent history fetch + store
- [ ] Create `modules/agents/agentsHistoryTypes.ts` with `AgentHistoryRecord` type (mirror the backend union: `user_message`, `assistant_message`, `rlm_tool_call`, `note`)
- [ ] Create `modules/agents/agentsHistoryFetch.ts` — fetches `GET /agents/:id/history`
- [ ] Create `modules/agents/agentsMessageSend.ts` — sends `POST /agents/:id/message`
- [ ] Add history state to agents Zustand store (or create a separate history store): `{ records, loading, error, fetchHistory, sendMessage }`
- [ ] Write tests for fetch/send functions
- [ ] Run tests — must pass before next task

### Task 2: Build AgentMessageItem component
- [ ] Create `views/agents/AgentMessageItem.tsx` that dispatches on `record.type`
- [ ] `user_message` → right-aligned bubble (background color from theme, plain text, timestamp)
- [ ] `assistant_message` → left-aligned text (extract text from content blocks, plain text only)
- [ ] `rlm_tool_call` → one-line: tool name + state (running/completed/error) with colored dot
- [ ] `note` → centered muted text
- [ ] Skip `rlm_start`, `rlm_complete`, `assistant_rewrite` types (return null)
- [ ] Write tests for type dispatch and rendering
- [ ] Run tests — must pass before next task

### Task 3: Build AgentMessageList component
- [ ] Create `views/agents/AgentMessageList.tsx` with inverted FlatList
- [ ] Sort records by `at` descending (newest first, inverted list shows them correctly)
- [ ] Handle empty state ("No messages yet")
- [ ] Handle loading state (ActivityIndicator)
- [ ] Write tests for list rendering, empty/loading states
- [ ] Run tests — must pass before next task

### Task 4: Build AgentInput component
- [ ] Create `views/agents/AgentInput.tsx` — minimal port from happy's AgentInput
- [ ] Multi-line TextInput with max height (120px)
- [ ] Send button (arrow-up icon) — enabled only when text is non-empty
- [ ] Enter-to-send on web (shift+enter for newline)
- [ ] `onSend(text)` callback, clears input after send
- [ ] Style with unistyles theme (input background, border radius, primary color send button)
- [ ] Write tests for send behavior and empty-text guard
- [ ] Run tests — must pass before next task

### Task 5: Build AgentDetailView screen
- [ ] Create `views/agents/AgentDetailView.tsx` composing header + AgentMessageList + AgentInput
- [ ] Header: back button + "Agent XXXXXXXX" title
- [ ] Wire fetchHistory on mount with agentId
- [ ] Wire sendMessage from AgentInput to the store/API
- [ ] After send, refresh history
- [ ] Write integration tests
- [ ] Run tests — must pass before next task

### Task 6: Add routing and navigation
- [ ] Create route file `app/(app)/agents/[agentId].tsx` that renders `AgentDetailView`
- [ ] Make agent items in `AgentsView` pressable — navigate to `/agents/:agentId` on tap
- [ ] Ensure back navigation works (back to agents list)
- [ ] Write test for navigation wiring
- [ ] Run tests — must pass before next task

### Task 7: Verify and polish
- [ ] Verify all record types render correctly with real API data
- [ ] Run full test suite
- [ ] Run linter (`yarn lint`) — fix all issues
- [ ] Run typecheck (`yarn typecheck`) — fix all issues

## Technical Details

### API shape (history)
```
GET /agents/:agentId/history?limit=100
→ { ok: true, history: AgentHistoryRecord[] }
```

Each record has `type` discriminator and `at` (unix ms timestamp).

Key record shapes:
- `user_message`: `{ type, at, text, files }`
- `assistant_message`: `{ type, at, content: AgentAssistantContent, tokens }` where content is array of blocks
- `rlm_tool_call`: `{ type, at, name, args, state, description, result }`
- `note`: `{ type, at, text }`

### API shape (send message)
```
POST /agents/:agentId/message
Body: { text: string }
→ { ok: true }
```

### Assistant content text extraction
`AgentAssistantContent` is `AssistantContentBlock[]` where blocks can be `{ type: "text", text: string }` or tool-use blocks. For minimal rendering, extract and join all `text` blocks.

## Post-Completion

**Manual verification:**
- Test with a running agent to see real message history
- Verify send message works and new messages appear
- Test empty agent (no history)
- Test on web and mobile layouts
