# Telegram Draft Messages

Telegram foreground conversations now keep a single editable bot message open while `run_python` is executing. The draft shows only the user-facing `run_python.description` steps, followed by the latest assistant text, and the connector edits that same Telegram message in place instead of sending separate intermediate replies.

## What Changed

- Added a small optional connector draft API to the core connector contract.
- Taught the Telegram connector to create text-only drafts with `sendMessage` and update them with `editMessageText`.
- Updated the agent loop to render only `run_python.description` step labels into a live draft when the connector supports drafts.
- Ordered the draft surface so step descriptions render first and assistant text renders after them.
- Kept persisted history unchanged: the app still reads normal `assistant_message`, `rlm_start`, and `rlm_tool_call` records.

```mermaid
sequenceDiagram
    participant U as Telegram user
    participant A as Agent loop
    participant T as Telegram connector
    participant TG as Telegram Bot API

    U->>A: message
    A->>T: createDraft("Steps: Check status")
    T->>TG: sendMessage(...)
    TG-->>T: message_id
    A->>T: update draft with step descriptions
    T->>TG: editMessageText(...)
    A->>T: finish draft with steps + latest assistant text
    T->>TG: editMessageText(...)
```

## Notes

- Drafts are text-only; file sends and button sends still use normal outbound messages.
- The draft text is a connector surface only. It does not change agent history storage or app history parsing.
- Inner tool names and raw arguments are intentionally excluded from Telegram drafts.
