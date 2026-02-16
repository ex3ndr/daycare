# Telegram restart command

This note documents the `/restart` command flow for restarting the Daycare server process.

```mermaid
sequenceDiagram
  participant U as User
  participant T as TelegramConnector
  participant E as Engine
  participant C as Connector
  participant S as Shutdown
  participant P as PM2/System Supervisor

  U->>T: /restart
  T->>E: onCommand("/restart", context, descriptor)
  E->>C: sendMessage("Restarting Daycare server...")
  E->>S: requestShutdown("SIGTERM")
  S->>P: process exits cleanly
  P->>E: start process again
```

- `/restart` is treated as a core slash command and is available even without plugins.
- The engine sends an acknowledgment message before requesting shutdown.
- Actual restart is performed by the runtime supervisor (for example PM2).
