# Memory Agent Prompt Usage

## Summary

This change tightens memory-agent behavior in two ways:

1. `first_message` prompts are no longer prepended for non-user agents, including `memory-agent`.
2. A runtime test now verifies that memory-agent inference receives the `MEMORY_AGENT.md` system prompt and that first-message prompt text is not injected into memory-agent input.

## Flow

```mermaid
sequenceDiagram
    participant MW as MemoryWorker
    participant AS as AgentSystem
    participant A as Agent(memory-agent)
    participant SPR as systemPromptResolve
    participant AP as agentPromptResolve
    participant IR as InferenceRouter

    MW->>AS: post(ctx, {descriptor: memory-agent}, system_message)
    AS->>A: handleSystemMessage(...)
    A->>SPR: resolve user prompts
    Note over A,SPR: first_message prepend only for user/subuser
    A->>AP: resolve descriptor prompt
    AP-->>A: memory/MEMORY_AGENT.md (replaceSystemPrompt=true)
    A->>IR: complete({ systemPrompt, messages })
```

## Why

Memory-agent runs should be driven by memory instructions only. Prepending first-message prompts intended for user-facing chat can dilute extraction behavior and cause prompt non-compliance.
