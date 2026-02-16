# Telegram stop command

This note documents the `/stop` and `/abort` command flow for aborting an in-flight
inference or compaction call.

```mermaid
sequenceDiagram
  participant U as User
  participant T as TelegramConnector
  participant E as Engine
  participant AS as AgentSystem
  participant A as Agent
  participant IR as InferenceRouter

  U->>T: /abort (or /stop)
  T->>E: onCommand("/abort", context, descriptor)
  E->>AS: abortInferenceForTarget(descriptor)
  AS->>A: abortInference()
  A->>IR: complete(..., signal) or compaction complete(..., signal)
  Note over A,IR: AbortSignal is triggered
  E->>T: sendMessage("Stopped current inference.")
```

- If no active inference exists for the target agent, the engine responds with `No active inference to stop.`.
- Aborted inference exits without sending the generic `Inference failed.` fallback message.
