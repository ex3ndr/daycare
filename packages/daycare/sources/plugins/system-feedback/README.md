# System Feedback Plugin

The System Feedback plugin adds a `system_feedback` tool that lets agents report bugs, missing capabilities, and runtime issues.

## Purpose

- Captures agent feedback with sender metadata.
- Appends each report to an append-only log file.
- Optionally forwards feedback as a visible system message to a configured target agent.

## Settings

```json
{
  "targetAgentId": "optional-target-agent-id"
}
```

- `targetAgentId` (optional): if provided, feedback is delivered to that agent.
- If omitted, the plugin runs in log-only mode.

## Onboarding

On setup, the plugin prompts for an optional target agent ID.

- Enter an agent ID to enable forwarding.
- Leave blank to keep log-only mode.

## Tool

### `system_feedback`

Parameters:

```json
{
  "prompt": "Feedback text describing what is not working or what capability is needed"
}
```

Behavior:

- Looks up the sender user profile from storage.
- Formats the feedback with sender metadata:
  - sender agent ID
  - sender user ID
  - sender user name
  - sender user nametag
- Appends a JSON line to the feedback log.
- If `targetAgentId` is configured, posts a visible `system_message` to that agent using origin `plugin:system-feedback`.

## Message Format

```md
## System Feedback

**From agent:** {agentId}
**From user:** {userName} (@{nametag}, id: {userId})

### Feedback
{prompt}
```

## Feedback Log Location

Each plugin instance writes to:

- `{dataDir}/feedback.log`

In a default runtime layout this resolves to:

- `.daycare/plugins/{instanceId}/feedback.log`

Each line is a JSON object with timestamp, sender identity, and feedback prompt.
