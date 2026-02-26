# Foreground Text Delivery

Foreground agents now forward plain assistant text directly to users. `<say>` tags are no longer parsed or required.

## Runtime Flow

```mermaid
sequenceDiagram
    participant Model as Foreground Model
    participant Loop as agentLoopRun
    participant Connector as Active Connector
    participant User as End User

    Model-->>Loop: assistant text response
    Loop->>Loop: detect run_python / NO_MESSAGE gates
    alt plain assistant text
        Loop->>Connector: sendMessage(channelId, { text, replyToMessageId })
        Connector-->>User: visible text
    else run_python or NO_MESSAGE
        Loop->>Loop: suppress direct user send for that turn
    end
```

## Prompt Guidance

- System formatting prompt no longer instructs `<say>...</say>` wrapping.
- Inline RLM prompt no longer references `<say>` tags.
- Foreground responses are expected as normal plain text.
