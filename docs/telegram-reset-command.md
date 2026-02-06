# Telegram reset command confirmation

This note documents the `/reset` command flow when received from Telegram.

```mermaid
sequenceDiagram
  participant U as Telegram user
  participant T as Telegram connector
  participant E as Engine
  participant A as AgentSystem
  participant G as Agent

  U->>T: /reset
  T->>E: onCommand("/reset", context, descriptor)
  E->>A: post({ type: "reset", context })
  A->>G: handleReset(item)
  G-->>A: reset applied
  G->>T: sendMessage("Session reset.", replyToMessageId)
  T-->>U: Session reset.
```

## Notes
- The reset command still clears session context with the same reset message payload.
- Engine only routes `/reset` and passes command context to the agent inbox item.
- Agent sends the direct connector response: `Session reset.`.
- The response keeps conversational threading by setting `replyToMessageId` from reset context.
