# Telegram Voice + Empty Message Filter

## Summary
- Telegram connector now ingests `voice` and `audio` attachments as files.
- Engine incoming message queue now drops connector payloads that have no text and no files.

## Flow
```mermaid
flowchart LR
    TG[Telegram Update] --> EXTRACT[connector.extractFiles]
    EXTRACT -->|voice/audio present| FILES[ConnectorMessage.files]
    EXTRACT -->|no media| TEXT[ConnectorMessage.text/rawText]
    FILES --> QUEUE[incomingMessages.post]
    TEXT --> QUEUE
    QUEUE --> CHECK{messageEmptyIs}
    CHECK -->|true| DROP[drop message]
    CHECK -->|false| FLUSH[batch + flush to agentSystem.post]
```

## Notes
- Voice notes no longer disappear as empty payloads because media is downloaded and attached.
- Empty payloads (e.g. whitespace-only text with no files) are filtered before debounce batching.
