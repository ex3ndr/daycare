# App Review Tool Context

App review prompts now include the exact set of tools available to the running
app sandbox (name, description, and parameter schema).

This prevents false denials where the reviewer confuses Daycare tool names with
language/runtime built-ins (for example, interpreting tool `exec` as Python
`exec()`).

The review prompt also includes the app's own runtime system prompt so policy
evaluation can account for the app's intended behavior and constraints.

## Prompt flow

```mermaid
sequenceDiagram
  participant App as App Agent
  participant Exec as appToolExecutorBuild
  participant Review as appToolReview
  participant Model as Review Model

  App->>Exec: tool call (name + args)
  Exec->>Exec: resolve allowed runtime tools
  Exec->>Review: appToolReview(toolCall + availableTools + rules + appSystemPrompt)
  Review->>Model: prompt with tools + app system prompt context
  Model-->>Review: ALLOW or DENY: reason
  Review-->>Exec: decision
```

## Prompt additions

- Added section: `## Available Tools In This Sandbox`
- Added tool entries:
  - `Name`
  - `Description`
  - `Parameters` (JSON schema)
- Added section: `## App System Prompt`
- Added explicit interpretation guard:
  - evaluate against provided tool list only
  - do not reinterpret names by language built-ins
