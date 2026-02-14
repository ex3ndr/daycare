# Agent Group Channels

## Overview

Add a **channel** concept — a group chat where multiple agents communicate via @mentions. Channels provide shared message history, signal-based delivery to individual agents, and a designated **leader** agent that routes unaddressed messages using inference.

Key concepts:
- **Username**: new field on permanent agents, used as the @mention handle
- **Channel**: named group with members, message history (JSONL), and a leader
- **Leader**: a permanent agent that receives all unaddressed messages and uses inference to decide routing
- **Signal-based delivery**: channel messages generate targeted signals to @mentioned agents (or the leader when no mentions)

How it integrates:
- Extends the existing `permanent` agent descriptor with a `username` field
- Uses the signal system for message delivery (agents subscribe to `channel.<name>:*`)
- Channels facade lives in the core engine (coordinates multiple agents — monolith per CLAUDE.md)
- New agent tools + CLI commands for channel management

## Context

- **Permanent agent descriptor** (`agentDescriptorTypes.ts`): already has `id`, `name`, `description`, `systemPrompt` — needs `username` added
- **Signal system** (`signals.ts`): supports pattern subscriptions, JSONL persistence, and delivery via `AgentSystem.signalDeliver()`
- **Agent inbox** (`agentTypes.ts`): has `signal` item type — channel messages will arrive as signals
- **Engine** (`engine.ts`): registers core tools and wires signals → agent system
- **Topology tool** (`topologyToolBuild.ts`): unified snapshot of agents, cron tasks, heartbeat tasks, and signal subscriptions — should be extended to include channels
- **ACTORS.md**: must be updated before implementation

## Development Approach

- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Update ACTORS.md with channel topology

- [x] Add channel leader agent entry to Agents table
- [x] Add channel signal subscriptions to Signal Subscriptions table
- [x] Update mermaid wiring diagram with channel signal flow
- [x] No tests needed (documentation only)

### Task 2: Add `username` to permanent agent descriptor

- [x] Add `username?: string` field to permanent variant in `AgentDescriptor` (`agentDescriptorTypes.ts`)
- [x] Update `create_permanent_agent` tool to accept optional `username` parameter
- [x] Update `agentDescriptorBuild.ts` / `agentDescriptorKeyBuild.ts` if they reference permanent fields
- [x] Update `agentDescriptorLabel` to include username for permanent agents (used by topology tool)
- [x] Write tests for descriptor creation with username
- [x] Run tests — must pass before next task

### Task 3: Channel types and persistence

- [x] Create `sources/engine/channels/channelTypes.ts` with types:
  - `Channel`: `{ id, name, leader, members: ChannelMember[], createdAt, updatedAt }`
  - `ChannelMember`: `{ agentId, username, joinedAt }`
  - `ChannelMessage`: `{ id, channelName, senderUsername, text, mentions: string[], createdAt }`
- [x] Create `sources/engine/channels/channelStore.ts` — persistence layer:
  - Channel config as JSON files in `.daycare/channels/<name>/channel.json`
  - Message history as JSONL in `.daycare/channels/<name>/history.jsonl`
  - `channelLoad(name)`, `channelSave(channel)`, `channelAppendMessage(name, message)`, `channelReadHistory(name, limit?)`
- [x] Re-export channel types from `@/types`
- [x] Write tests for channel store (create, save, load, append message, read history)
- [x] Run tests — must pass before next task

### Task 4: Channels facade class

- [x] Create `sources/engine/channels/channels.ts` — `Channels` facade:
  - `constructor(args: { configDir, signals, agentSystem })` — dependencies injected
  - `ensureDir()` — ensure `.daycare/channels/` exists
  - `load()` — load all channels from disk on startup
  - `create(name, leaderAgentId)` — create a new channel
  - `delete(name)` — remove a channel
  - `addMember(channelName, agentId, username)` — add agent to channel, auto-subscribe to `channel.<name>:*` signal pattern
  - `removeMember(channelName, agentId)` — remove agent, unsubscribe from channel signals
  - `send(channelName, senderUsername, text, mentions: string[])` — core message routing:
    1. Append message to channel history
    2. If mentions present: generate signal `channel.<name>:message` with data `{ mentions }` — delivery goes to mentioned agents + leader
    3. If no mentions: generate signal `channel.<name>:message` with data `{ mentions: [] }` — delivery goes to leader only
  - `getHistory(channelName, limit?)` — read recent messages
  - `list()` — list all channels
  - `get(name)` — get channel details
- [x] Wire signal subscriptions: when a member is added, call `signals.subscribe({ agentId, pattern: "channel.<name>:*", silent: false })`
- [x] Handle selective delivery in `send()`: generate per-agent signals so only the right agents receive the message (leader always receives; other agents only when @mentioned)
- [x] Write tests for Channels facade (create, add/remove member, send with/without mentions, history)
- [x] Run tests — must pass before next task

### Task 5: Wire Channels into Engine and extend topology tool

- [x] Add `Channels` instance to `Engine` class (`engine.ts`)
- [x] Initialize in constructor with dependencies (`configDir`, `signals`, `agentSystem`)
- [x] Call `channels.ensureDir()` and `channels.load()` in `Engine.start()`
- [x] Extend `topologyToolBuild.ts` to include a `## Channels` section in its snapshot output (channel name, leader, members with usernames)
- [x] Pass `Channels` dependency to the topology tool builder
- [x] Write tests for topology tool channel output
- [x] Run tests — must pass before next task

### Task 6: Agent tools for channel interaction

- [x] Create `sources/engine/modules/tools/channelCreateTool.ts` — `channel_create` tool:
  - Parameters: `name`, `leaderAgentId`
  - Creates the channel via Channels facade
- [x] Create `sources/engine/modules/tools/channelSendTool.ts` — `channel_send` tool:
  - Parameters: `channelName`, `text`, `mentions?: string[]`
  - Sends message to channel (sender is the calling agent's username)
- [x] Create `sources/engine/modules/tools/channelHistoryTool.ts` — `channel_history` tool:
  - Parameters: `channelName`, `limit?`
  - Returns recent messages from channel history
- [x] Create `sources/engine/modules/tools/channelMemberTool.ts` — `channel_add_member` / `channel_remove_member` tools:
  - Parameters: `channelName`, `agentId`, `username`
- [x] Register all channel tools in `Engine.start()` via `this.modules.tools.register("core", ...)`
- [x] Note: channel listing is handled by the topology tool (Task 5), no separate `channel_list` tool needed
- [x] Write tests for each tool (parameter validation, correct facade calls)
- [x] Run tests — must pass before next task

### Task 7: Channel message formatting for agents

- [x] Create `sources/engine/channels/channelMessageBuild.ts` — format channel signal into readable system message for the receiving agent:
  - Include channel name, sender username, message text, and mention list
  - Include recent channel history context (last N messages) so agent has conversation context
  - Format: `[Channel: #<name>] @<sender>: <text> (mentions: @<user1>, @<user2>)`
- [x] Update signal handling in agent to recognize channel signals and format them with channel context
- [x] Write tests for message formatting
- [x] Run tests — must pass before next task

### Task 8: CLI commands for channel management

- [x] Create `sources/commands/channelCreate.ts` — `daycare channel create <name> --leader <agentId>` command
- [x] Create `sources/commands/channelList.ts` — `daycare channel list` command
- [x] Create `sources/commands/channelAddMember.ts` — `daycare channel add-member <channelName> <agentId> <username>` command
- [x] Create `sources/commands/channelRemoveMember.ts` — `daycare channel remove-member <channelName> <agentId>` command
- [x] Create `sources/commands/channelSend.ts` — `daycare channel send <channelName> <text>` command (for testing)
- [x] Register subcommands in CLI entry point
- [x] Write tests for CLI command parsing
- [x] Run tests — must pass before next task

### Task 9: Verify acceptance criteria

- [x] Verify: permanent agents can have usernames
- [x] Verify: channels can be created with a leader
- [x] Verify: agents can be added/removed from channels
- [x] Verify: @mentioned agents receive channel messages as signals
- [x] Verify: unaddressed messages go to the leader only
- [x] Verify: channel message history is persisted and retrievable
- [x] Verify: leader can read and route messages via tools
- [x] Run full test suite (`yarn test`)
- [x] Run typecheck (`yarn typecheck`)
- [x] All tests and typecheck must pass

### Task 10: [Final] Update documentation

- [x] Update doc/ with channel architecture documentation and mermaid diagrams
- [x] Update README.md if needed

## Technical Details

### Signal Patterns

```
channel.<channelName>:message    — a message posted to the channel
```

Signal data payload:
```typescript
{
  channelName: string;
  messageId: string;
  senderUsername: string;
  text: string;
  mentions: string[];      // usernames mentioned
  createdAt: number;
}
```

### Delivery Logic

```
send("dev", "alice", "Hey @bob check this out", ["bob"])
  → append to history
  → deliver signal to "bob" (mentioned)
  → deliver signal to leader (always receives)

send("dev", "alice", "What should we do next?", [])
  → append to history
  → deliver signal to leader only (no mentions, leader routes)
```

### Channel Directory Structure

```
.daycare/channels/
  dev/
    channel.json       # { name, leader, members, createdAt, updatedAt }
    history.jsonl       # append-only message log
  ops/
    channel.json
    history.jsonl
```

### Agent Signal Subscription on Join

When `addMember("dev", agentId, "bob")` is called:
```typescript
signals.subscribe({
  agentId,
  pattern: "channel.dev:message",
  silent: false
});
```

The Channels facade handles selective delivery — it doesn't rely on subscriptions for filtering @mentions. Instead, it generates per-target signals directly to the right agents.

## Post-Completion

**Manual verification:**
- Create a channel with 3 permanent agents (each with usernames)
- Send messages with and without @mentions
- Verify leader receives unaddressed messages and can route them
- Verify @mentioned agents receive only their messages
- Check history persistence survives restart
