# Telegram Sticker Forwarding

## Summary

Telegram sticker-only messages are now normalized as connector files so the AI can inspect sticker content.
The connector downloads each sticker variant and forwards it via `ConnectorMessage.files`.

## Sticker mapping

- Static sticker: `.webp` + `image/webp`
- Animated sticker: `.tgs` + `application/x-tgsticker`
- Video sticker: `.webm` + `video/webm`

## Flow

```mermaid
flowchart TD
  A[Incoming Telegram message] --> B{message.sticker exists?}
  B -->|No| C[Run existing file extractors]
  B -->|Yes| D[Resolve sticker type]
  D --> E[Download file from Telegram]
  E --> F[Save into file store with name and mimeType]
  F --> G[Append FileReference to ConnectorMessage.files]
  C --> H[Dispatch to message handlers]
  G --> H
```
