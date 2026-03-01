# Agent System Trivial Function Inlining

## Summary

Refactored `AgentSystem` by inlining trivial single-purpose helpers directly at call sites:

- foreground selection prefix mapping
- lifecycle state rank mapping
- lifecycle signal type string formatting
- dead-agent error creation
- poison-pill signal id parsing in event handling

This removes indirection for tiny one-liner helpers and keeps behavior unchanged.

## Flow

```mermaid
flowchart TD
    A[AgentSystem event/sort/lifecycle paths] --> B{Needs tiny helper?}
    B -->|Before| C[Call separate trivial function]
    B -->|After| D[Inline expression at call site]
    C --> E[Same runtime behavior]
    D --> E
```
