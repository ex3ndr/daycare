---
name: voice-agents-creator
description: Create reusable Daycare voice agents with the hidden-by-default `voice_agent_create` tool. Use when users want a new voice persona, a realtime call prompt, client-side voice tools, or a saved voice agent that appears in the app Voice screen.
tools:
  - voice_agent_create
---

# Voice Agent Creation

Use `voice_agent_create` to save a reusable voice agent record for the current workspace user.

## What It Creates

Each voice agent stores:

- `name`: label shown in the app
- `description`: short summary for the voice-agent list
- `systemPrompt`: the prompt injected into the live voice session
- `tools`: client-side tool definitions exposed to the voice SDK during a call
- `settings`: provider-specific configuration such as `providerId`

Voice agents are separate from regular text agents. They appear in the app's Voice section and are used to bootstrap realtime voice sessions.

## Tool Shape

Use this payload shape:

```python
voice_agent_create({
    "name": "Concierge",
    "description": "Front-desk helper for live calls.",
    "systemPrompt": "You are a calm, efficient concierge for Daycare.",
    "tools": [
        {
            "name": "lookup_booking",
            "description": "Find a booking by confirmation code.",
            "parameters": {
                "confirmationCode": {
                    "type": "string",
                    "description": "Booking confirmation code.",
                    "required": True,
                }
            },
        }
    ],
    "settings": {
        "providerId": "elevenlabs"
    }
})
```

## Rules

1. Keep `systemPrompt` voice-first. It should tell the agent how to speak, confirm details, and handle interruptions naturally.
2. Keep tool definitions narrow. Only expose tool parameters the user can realistically provide in a live conversation.
3. Set `settings.providerId` when more than one voice provider is configured.
4. Treat `tools` as client-side callbacks for the live voice SDK, not normal server-executed Daycare tools.

## Output Expectations

The tool returns the created voice-agent ID and name. After creation, the agent should appear in the app Voice list and can be started through the voice session API.
