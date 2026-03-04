# Daycare App Chat Maximum Update Depth Fix

## Summary

Fixed a render loop in the app chat module by making chat session selection return stable references.

Changes:

- Added `chatSessionSelect.ts` to select `ChatSessionView` without creating new objects per render.
- Updated `chatContext.ts` to use `chatSessionSelect`.
- Added `chatSessionSelect.spec.ts` to verify stable empty-view and session reference behavior.

This prevents repeated selector value churn that can cascade into repeated updates in React render cycles.

## Selector Flow

```mermaid
flowchart TD
  A[useChat agentId] --> B[chatSessionSelect sessions agentId]
  B --> C{agentId exists?}
  C -- no --> D[Return shared CHAT_SESSION_EMPTY reference]
  C -- yes --> E{session exists?}
  E -- no --> D
  E -- yes --> F[Return existing session object reference]
  D --> G[Stable selector result]
  F --> G
  G --> H[No unnecessary re-renders]
```
