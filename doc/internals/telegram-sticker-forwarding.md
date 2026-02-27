# Telegram Sticker Forwarding

## Summary

Telegram sticker-only messages are now normalized as connector files so the AI can inspect sticker content.
The connector downloads each sticker variant and forwards it via `ConnectorMessage.files`.
Repeated messages with the same Telegram `file_id` now reuse the cached `FileReference` and skip re-download.
The cache is written into connector state (`statePath`) so dedupe survives restarts.

## Sticker mapping

- Static sticker: `.webp` + `image/webp`
- Animated sticker: `.tgs` + `application/x-tgsticker`
- Video sticker: `.webm` + `video/webm`

## Flow

```mermaid
flowchart TD
  S[Connector startup] --> T[Load statePath JSON]
  T --> U[Restore filesByTelegramId cache]
  A[Incoming Telegram message] --> B{message.sticker exists?}
  B -->|No| C[Run existing file extractors]
  B -->|Yes| D{file_id cached?}
  D -->|Yes| E[Reuse cached FileReference]
  D -->|No| F[Resolve sticker type]
  F --> G[Download file from Telegram]
  G --> H[Save into file store with name and mimeType]
  H --> I[Cache FileReference by file_id]
  I --> P[Persist filesByTelegramId to statePath]
  U --> D
  C --> J[Dispatch to message handlers]
  E --> J
  P --> J
```
