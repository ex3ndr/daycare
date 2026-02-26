# Foreground `say` Tool

Adds a dedicated `say` tool for foreground user agents so model output can be delivered immediately without relying on `<say>...</say>` text wrapping.

## Runtime Flow

```mermaid
sequenceDiagram
    participant Model as Foreground Model
    participant Tool as say tool
    participant Resolver as connectorRegistry
    participant Connector as Active Connector
    participant User as End User

    Model->>Tool: say(text)
    Tool->>Resolver: get(connectorId)
    Resolver-->>Tool: connector instance
    Tool->>Connector: sendMessage(channelId, { text, replyToMessageId })
    Connector-->>User: visible message
    Tool-->>Model: toolResult("Sent user-visible message.")
```

## Prompt Guidance

- Foreground tool-calling guidance now tells the model to prefer `say` when available.
- Foreground no-tools (`<run_python>`) guidance now also states that `say(...)` is preferred for user-visible output.
- `<say>...</say>` behavior remains as a fallback path.
