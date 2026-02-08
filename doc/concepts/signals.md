# Signals

Signals are the broadcast event system for decoupled, multi-agent coordination. They are fire-and-forget broadcasts that any agent can subscribe to by pattern.

## When to use signals vs direct messages

| Use signals when... | Use direct messages when... |
|---------------------|----------------------------|
| Multiple agents may react independently | You need request/response between specific agents |
| The producer doesn't need to know who listens | The sender needs an answer back |
| Event notifications (build done, state change) | Directed tasks or specific requests |

## Signal structure

Each signal has:
- `id` - cuid2 identifier
- `type` - colon-separated string (e.g. `build:project-x:done`)
- `source` - origin identifier (see below)
- `data` - optional payload
- `createdAt` - unix timestamp in milliseconds

### Source types

| Source | Description |
|--------|-------------|
| `{ type: "system" }` | Internal system events (lifecycle signals) |
| `{ type: "agent", id }` | Emitted by an agent |
| `{ type: "webhook", id? }` | Triggered by external webhook |
| `{ type: "process", id? }` | Emitted by a running process |

## Subscriptions

Agents subscribe to signals using patterns with wildcard matching:

```
pattern: "build:*:done"
matches: "build:project-x:done", "build:frontend:done"
```

`*` matches exactly one colon-separated segment.

### Delivery modes

| Mode | Behavior |
|------|----------|
| `silent=true` (default) | Delivered as silent system message; does not trigger inference |
| `silent=false` | Delivered as regular system message; triggers inference |

## Tools

| Tool | Description |
|------|-------------|
| `generate_signal` | Emit a signal with a type, optional source, and optional data |
| `signal_subscribe` | Subscribe to signals matching a pattern |
| `signal_unsubscribe` | Remove a subscription by exact pattern match |

## Delayed signals

Signals can be scheduled for future delivery using wall-time timestamps.

- Stored in `<config>/signals/delayed.json`
- Dispatched once `deliverAt` timestamp is reached
- Semantics are **at least once** (retry on failure)
- `repeatKey` allows deduplication: scheduling `(type, repeatKey)` replaces any older queued entry with the same pair

## Agent lifecycle signals

The system automatically emits lifecycle signals:
- `agent:<agentId>:wake` - when an agent transitions to active
- `agent:<agentId>:sleep` - when an agent transitions to sleeping

## Storage

- Active signals: `<config>/signals/events.jsonl`
- Delayed signals: `<config>/signals/delayed.json`
- Dashboard API: `GET /v1/engine/signals/events?limit=<n>` (default 200, max 1000)
