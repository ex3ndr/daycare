# Foreground Text Delivery

Foreground agents prefer the `say` tool for user-visible output, while still forwarding plain assistant text directly.
`<say>` tags are no longer parsed or required.

## Runtime Flow

```mermaid
sequenceDiagram
    participant Model as Foreground Model
    participant Loop as agentLoopRun
    participant Say as say tool
    participant Connector as Active Connector
    participant User as End User

    alt model calls say(text)
        Model->>Say: say(text)
        Say->>Connector: sendMessage(channelId, { text, replyToMessageId })
        Connector-->>User: visible text
    else model returns assistant text
        Model-->>Loop: assistant text response
        Loop->>Loop: detect run_python / NO_MESSAGE gates
        Loop->>Connector: sendMessage(channelId, { text, replyToMessageId })
        Connector-->>User: visible text
    end
```

## Prompt Guidance

- Tool-calling prompt says foreground agents should prefer the `say` tool.
- Plain text responses are still forwarded when the model does not call `say`.
- Inline RLM prompt prefers `say(...)` when available and also allows plain-text follow-ups.
