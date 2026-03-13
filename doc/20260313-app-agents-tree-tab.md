# App Agents Tree Tab

## Summary

Added a second tab to the app's Agents screen so operators can switch between:

- the existing grouped card list
- a path-derived file-tree view rendered as a monospace hierarchy

The tree is built entirely from `agent.path`, so child agents such as `sub`, `memory`, and `search` now appear
under their parent node without adding new API fields.

## Flow

```mermaid
flowchart TD
  A[GET /agents] --> B[Agents store]
  B --> C[Agents screen]
  C --> D[List tab]
  C --> E[Tree tab]
  E --> F[Parse agent.path]
  F --> G[Derive parent-child edges]
  G --> H[Render filesystem-style tree]
```

## Example

```mermaid
flowchart TD
  A[agents/] --> B[Telegram]
  B --> C[Memory Worker]
  B --> D[Memory Search]
  B --> E[Subagent]
```
