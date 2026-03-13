# App Agents Graph Tab

## Summary

Added a second tab to the app's Agents screen so operators can switch between:

- the existing grouped card list
- a path-derived Mermaid graph rendered as selectable ASCII text

The graph is built entirely from `agent.path`, so child agents such as `sub`, `memory`, and `search` now appear
under their parent node without adding new API fields.

## Flow

```mermaid
flowchart TD
  A[GET /agents] --> B[Agents store]
  B --> C[Agents screen]
  C --> D[List tab]
  C --> E[Graph tab]
  E --> F[Parse agent.path]
  F --> G[Derive parent-child edges]
  G --> H[Render ASCII Mermaid block]
```

## Example

```mermaid
graph TD
  connector["Telegram | connector | active"]
  memory["Memory Worker | memory | active"]
  search["Memory Search | search | active"]
  sub["Subagent | sub | sleeping"]

  connector --> memory
  connector --> search
  connector --> sub
```
