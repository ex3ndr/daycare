# Telegram File Upload Content Type

## Summary

Telegram file uploads now always include explicit `fileOptions`:

- `filename`: from `ConnectorFile.name`
- `contentType`: from `ConnectorFile.mimeType`

This avoids the `node-telegram-bot-api` deprecation warning about future defaulting to `application/octet-stream`.

The connector now also supports explicit `sendAs: "voice"` and routes these files through Telegram `sendVoice`.

## Flow

```mermaid
flowchart TD
  A[ConnectorMessage with files] --> B[TelegramConnector.sendFileWithOptions]
  B --> C{sendAs or mimeType}
  C -->|photo| D[bot.sendPhoto path options fileOptions]
  C -->|video| E[bot.sendVideo path options fileOptions]
  C -->|document| F[bot.sendDocument path options fileOptions]
  C -->|voice| H[bot.sendVoice path options fileOptions]
  D --> G[fileOptions: filename + contentType]
  E --> G
  F --> G
  H --> G
```
