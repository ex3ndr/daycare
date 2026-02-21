# Engine Agent Loop

The Agent owns the end-to-end agent loop:
- resolve permissions (cron/heartbeat)
- build the system prompt + tool context
- run the inference/tool loop
- persist state and emit outgoing events

```mermaid
flowchart TD
  Engine[engine.ts] --> Agent[agents/agent.ts]
  Agent --> Perms[permissions/*]
  Agent --> Prompt[agent.ts buildSystemPrompt]
  Agent --> Loop[agents/ops/agentLoopRun.ts]
  Loop --> Inference[inference/router.ts]
  Loop --> Tools[modules.ToolResolver]
  Agent --> Store[agents/ops/*]
  Loop --> Connector[connectors/*]
```

## Agent Creation

Agent creation is deterministic and does not depend on inbound message context.
Message delivery uses the inbound connector source; system messages derive the connector
from the target agent descriptor.

```mermaid
flowchart TD
  Create[Agent.create] --> Persist[descriptor.json + state.json]
  Message[Agent.handleMessage] --> Source[connector source]
  Source --> Send[connector.sendMessage]
```

## Bundled Prompt Resolution

System prompt templates are bundled under `sources/prompts/` and read through
`agentPromptBundledRead`.

```mermaid
flowchart LR
  Read[agentPromptBundledRead] --> Prompts[sources/prompts/*.md]
  Prompts --> System[buildSystemPrompt]
```

## Context Compaction

Long-running sessions can be compacted into a single summary message using the
COMPACTION prompt and a normal-size model selection.

```mermaid
flowchart LR
  Context[Context messages] --> Compact[agents/ops/contextCompact.ts]
  Compact --> Prompt[sources/prompts/COMPACTION.md]
  Compact --> Router[inference/router.ts]
  Router --> Model[normal-size model]
  Model --> Summary[assistant summary message]
```

## Inference Error Handling

Inference error responses are treated as normal failures and do not trigger
automatic emergency session reset.

```mermaid
flowchart LR
  Inference[inference/router.ts] --> Error[stopReason=error]
  Error --> Notify[send \"Inference failed.\"]
  Notify --> Continue[session state preserved]
```

## Reset System Messages

Reset markers can carry an optional message that is injected as a system-level
note at the beginning of the next context so models understand why a reset happened.

```mermaid
flowchart LR
  ResetRecord[history.jsonl reset + message] --> Build[buildHistoryContext]
  Build --> SystemMsg[<system_message origin=\"<agentId>\">...]
  SystemMsg --> Context[context messages]
```

## State vs History

`state.json` only stores durable metadata (permissions, timestamps, lifecycle state).
Conversation context is rebuilt from `history.jsonl` instead of being persisted in state.

```mermaid
flowchart LR
  State[state.json] --> Meta[permissions + timestamps + lifecycle state]
  History[history.jsonl] --> Context[context messages]
  Context --> Loop[inference loop]
```

## Agent Sleep Mode

After processing a message or reset, the agent marks itself sleeping when the inbox is empty.
Sleeping agents are skipped on boot and only restored when a new inbox item arrives, which
wakes them before enqueueing.

```mermaid
sequenceDiagram
  participant Inbox
  participant Agent
  participant System
  participant Disk
  Agent->>System: sleepIfIdle()
  System->>Inbox: check empty
  System->>Disk: write state.state=\"sleeping\"
  Note right of Agent: skipped on boot
  Inbox-->>System: post item
  System->>Disk: write state.state=\"active\"
  System->>Inbox: enqueue item
  System->>Agent: start/restore
```

## Durable Inbox

Queued inbox work now persists in SQLite (`inbox` table) so items survive process restarts.
`post()` writes first, the agent loop deletes rows after handling each item, and boot replay
restores queued rows after a synthetic `restore` item.

```mermaid
sequenceDiagram
  participant Caller
  participant AgentSystem
  participant SQLite
  participant AgentInbox
  participant Agent

  Caller->>AgentSystem: post(target, item)
  AgentSystem->>SQLite: INSERT inbox(id, agent_id, posted_at, type, data)
  AgentSystem->>AgentInbox: post(item)
  Agent->>AgentInbox: next()
  Agent->>Agent: handleInboxItem(item)
  Agent->>SQLite: DELETE inbox WHERE id = ?

  Note over AgentSystem,AgentInbox: Boot replay
  AgentSystem->>AgentInbox: post({ type: "restore" })
  AgentSystem->>SQLite: SELECT * FROM inbox WHERE agent_id = ? ORDER BY posted_at
  AgentSystem->>AgentInbox: post(persisted item, merge=false)
```
