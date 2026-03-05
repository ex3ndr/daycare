# Fragment Examples TodoList Update

Updated the app dev examples page to use the current fragment component catalog and added an interactive TodoList example.

## Changes

- Reworked `packages/daycare-app/sources/views/dev/ExamplesView.tsx` to use current fragment components (`ScrollView`, `View`, `Section`, `Card`, `Item`, `ProgressBar`).
- Added `state.todos` in the example spec.
- Added a `TodoList` section bound to `/todos` with:
  - separators
  - checkbox toggles
  - inline title editing
  - hint/pill/counter/icon metadata
  - two-state toggle icon configuration
- Switched `ExamplesView` to provide a store via `createStateStore(examplesSpec.state)` so `TodoList` binding is interactive in dev examples.

```mermaid
flowchart TD
    A[ExamplesView] --> B[createStateStore(spec.state)]
    B --> C[JSONUIProvider store]
    C --> D[Renderer examplesSpec]
    D --> E[TodoList props.items = bind /todos]
    E --> F[Interactive row updates in dev examples]
```
