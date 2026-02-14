# Agent Group Channels

This document describes group channel support for Daycare agents.

## Overview

Channels provide shared group messaging between agents using `@username` mentions.

- Permanent agents now support optional `username` in their descriptor.
- Channels are persisted under `<configDir>/channels/<name>/`.
- Channel messages are stored in append-only `history.jsonl`.
- A designated leader agent always receives channel messages.
- Mentioned members receive targeted channel signal deliveries.

## Data Model

- `Channel`: `{ id, name, leader, members, createdAt, updatedAt }`
- `ChannelMember`: `{ agentId, username, joinedAt }`
- `ChannelMessage`: `{ id, channelName, senderUsername, text, mentions, createdAt }`

## Signal Flow

Channel delivery uses signal inbox events with signal type:

- `channel.<channelName>:message`

The signal payload includes:

- `channelName`
- `messageId`
- `senderUsername`
- `text`
- `mentions`
- `createdAt`
- `history` (recent messages for context formatting)

## Storage Layout

```text
<configDir>/channels/
  dev/
    channel.json
    history.jsonl
```

## Wiring

```mermaid
graph LR
  AgentA[Agent sender] -->|channel_send| ChannelsFacade[Channels facade]
  ChannelsFacade -->|append| History[(history.jsonl)]
  ChannelsFacade -->|signal: channel.dev:message| Leader[Leader agent]
  ChannelsFacade -->|signal: channel.dev:message| Mentioned[Mentioned members]
  Mentioned -->|formatted system message| AgentLoop[Agent inference loop]
  Leader -->|routing decisions| AgentLoop
```

