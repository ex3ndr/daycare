# ACTORS

## Agents

| Name | Kind | Role |
| --- | --- | --- |
| `user` agent | runtime | Foreground conversation agent bound to a connector user/channel. |
| `cron` agent | runtime | Scheduled/background worker for cron tasks. |
| `heartbeat` system agent | system | Runs periodic heartbeat checks and actions. |
| `architect` system agent | system | Handles architecture and topology-oriented planning/execution. |
| `subagent` agent | runtime | Child worker agent created by another agent for delegated tasks. |
| `permanent` agent | runtime | Long-lived named background specialist agent. |
| `AgentSystem` | monolith coordinator | Owns agent lifecycle, routing, and state transitions (sleep/wake/dead). |

## Signal Subscriptions

| Subscriber | Pattern | Silent | Purpose |
| --- | --- | --- | --- |
| Channel members (via `Channels`) | `channel:{channelName}:message` | `false` | Deliver channel activity to members as signal inbox items. |
| Any agent (via `signal_subscribe` tool) | user-defined pattern with `*` wildcards | default `true` | Dynamic runtime automation/event reactions. |
| `AgentSystem` (event bus listener) | `agent:{agentId}:poison-pill` | n/a | Handle delayed subagent termination and transition sleeping/active subagents to `dead`. |

## Topology

```mermaid
graph LR
  DelayedSignals[DelayedSignals scheduler] -->|signal.generated: agent:{id}:poison-pill| EventBus[EngineEventBus]
  EventBus --> AgentSystem[AgentSystem]
  AgentSystem -->|state write| SubagentState[(agents/{id}/state.json)]
  AgentSystem -->|agent.sleep / agent.woke / agent.dead| EventBus

  Signals[Signals registry] -->|deliver subscriptions| AgentSystem
  AgentSystem -->|post signal item| RuntimeAgents[User/Cron/Subagent/Permanent agents]

  Channels[Channels facade] -->|subscribe channel:{name}:message| Signals
  Signals -->|matching channel signal| RuntimeAgents
```
