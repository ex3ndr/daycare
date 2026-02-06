---
name: permanent-agent-creator
description: Guide for creating and updating permanent agents with stable names, dedicated system prompts, and optional workspace folders.
license: Complete terms in LICENSE.txt
---

# Permanent Agent Creator

This skill provides guidance for creating and updating permanent agents.

## About Permanent Agents

Permanent agents are background agents with stable identities. They are created once and reused across sessions, with a dedicated system prompt that can be updated over time.

### What Permanent Agents Provide

1. Stable identity - predictable agent ids you can reference later
2. Dedicated system prompts - durable instructions for specialized roles
3. Optional workspace folders - focused file scopes inside the main workspace
4. Reusable collaboration - multiple agents can coordinate through a named helper

## Core Principles

### Keep Prompts Focused

Permanent agents should be narrow and durable. Prefer a short system prompt that captures role, constraints, and communication style.
Avoid task-specific instructions that should live in the user request instead.

### Stable Names Matter

Names are how humans recognize agents. Pick a short, descriptive name and avoid frequent renames.
If a name needs to change, update it deliberately alongside the system prompt.

### Scope Workspace When Needed

Only assign a workspace subfolder when the agent needs a dedicated area (e.g., a specific project or dataset).
Default to the main workspace when no isolation is required.

## Workflow

1. **Gather inputs**
   - Agent name
   - Short description
   - System prompt
   - Optional workspace subfolder

2. **Create or update**
   Use `create_permanent_agent` with the collected inputs. Reusing a name updates the existing agent.

3. **Share the agent id**
   Store the returned agent id and use `send_agent_message` to coordinate with it.

## Example

Create a release helper:

```
create_permanent_agent({
  name: "Release Tracker",
  description: "Tracks release readiness and reports risks.",
  systemPrompt: "You track release status, summarize risks, and report progress to the main agent.",
  workspaceDir: "release-notes"
})
```

Then delegate work:

```
send_agent_message({
  agentId: "<agent-id>",
  text: "Summarize the latest release checklist status."
})
```
