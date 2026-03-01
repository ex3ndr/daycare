# 20260301 Telegram Channel/User Path Routing

## Summary

Telegram connector paths now include both chat and sender identity so connector resolution can disambiguate multiple users in the same channel.

- New connector path shape: `/<internalUserId>/telegram/<channelId>/<telegramUserId>`
- Incoming Telegram messages emit path hints as `/<telegramUserId>/telegram/<channelId>/<telegramUserId>` and are canonicalized to internal user scope.
- Connector target resolution prefers exact `telegram:<channelId>/<telegramUserId>` keys, with a private-chat fallback to legacy `telegram:<channelId>`.

## Routing flow

```mermaid
flowchart TD
    A[Telegram update chatId + fromId] --> B[Connector emits /fromId/telegram/chatId/fromId]
    B --> C[Engine canonicalizes via connector key lookup]
    C --> D[Resolve/create user for telegram:chatId/fromId]
    D --> E[Canonical path /internalUserId/telegram/chatId/fromId]
```

## Outbound target resolution

```mermaid
flowchart TD
    A[Agent path /internal/telegram/chat/user] --> B[Try exact key telegram:chat/user]
    B -->|found| C[Send to chat/user target]
    B -->|not found| D{private chat? chat == user}
    D -->|yes| E[Try legacy key telegram:chat]
    D -->|no| F[Fallback to first telegram:* key]
```
