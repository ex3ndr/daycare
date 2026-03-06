# Telegram URL Button App-Open Flag

Superseded on 2026-03-06 by `doc/20260306-telegram-webapp-inline-buttons.md`.

## Summary
- Added Telegram URL-button normalization for Daycare frontend links.
- If a URL button points to `https://daycare.dev` or the configured Telegram app frontend origin, `openApp=1` is appended.
- Markdown/body links are unchanged; only explicit URL buttons are rewritten.

## Button URL Flow
```mermaid
flowchart TD
    A[Connector sendMessage with buttons] --> B{Button type}
    B -->|callback| C[Keep callback_data as-is]
    B -->|url| D[Parse URL]
    D --> E{Origin matches daycare.dev or configured app frontend}
    E -->|no| F[Leave URL unchanged]
    E -->|yes| G[Set query param openApp=1]
    G --> H[Send inline keyboard button]
```

## Scope
- Applied in Telegram connector URL button rendering only.
- No changes to markdown link rendering logic.
