# AgentSystem

AgentSystem owns the session-backed agent lifecycle:
- load agent sessions from disk
- queue inbound messages before execution starts
- spawn and message background agents
- expose session info for resets and status

AgentSystem boots in stages:
1. **load()** restores sessions + queues pending notifications (no execution)
2. **enableScheduling()** lets the module registry enqueue messages
3. **start()** drains queues and begins agent execution

```mermaid
flowchart TD
  Engine[engine.ts] --> AgentSystem[agents/agentSystem.ts]
  AgentSystem --> Store[sessions/store.ts]
  AgentSystem --> Manager[sessions/manager.ts]
  AgentSystem --> Agent[agents/agent.ts]
  Agent --> Loop[agents/agentLoopRun.ts]
  AgentSystem --> Connectors[modules/connectorRegistry.ts]
  AgentSystem --> Tools[modules/toolResolver.ts]
  AgentSystem --> Inference[inference/router.ts]
```
