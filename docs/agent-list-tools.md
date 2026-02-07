# Agent List Tools

Daycare includes one listing tool for session/agent discovery:

- `list_agents`: all persisted agents (user + background) with ids, type, name/label, lifecycle, and descriptor-specific metadata.

The tool returns a machine-readable `details` payload with `count` and `agents`.

```mermaid
flowchart TD
  A[Tool call list_agents] --> B[agentList]
  B --> C[descriptor + state from disk]
  C --> D[sorted agent summaries]
  D --> E[text output + details.count + details.agents]
```
