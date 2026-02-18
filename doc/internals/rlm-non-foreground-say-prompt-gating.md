# RLM Non-Foreground `<say>` Prompt Gating

## Summary

In no-tools RLM mode, the inline Python section now renders `<say>` guidance only for foreground agents.  
Background/subagent/app/permanent/system agents still receive `<run_python>` instructions, but they no longer see `<say>` tag policy text.

## Flow

```mermaid
flowchart TD
  A[Agent system prompt build] --> B[Tool-calling section]
  B --> C{noTools enabled?}
  C -->|No| D[Render base tool-calling text]
  C -->|Yes| E[Build RLM inline prompt]
  E --> F{is foreground agent?}
  F -->|Yes| G[Include run_python + say guidance]
  F -->|No| H[Include run_python guidance only]
  G --> I[Final system prompt]
  H --> I[Final system prompt]
  D --> I
```
