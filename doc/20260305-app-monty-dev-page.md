# App Monty Dev Page

## Summary

Added `react-native-monty` from npm to `daycare-app` and introduced a new `Monty` dev subpage at `/dev/monty`.
The page runs lightweight runtime smoke checks: runtime load, basic script execution, and external function callback execution.

## Changes

- Added `react-native-monty` dependency in `packages/daycare-app/package.json`.
- Added `MontyDevView` in `packages/daycare-app/sources/views/dev/MontyDevView.tsx`.
- Wired `/dev/monty` into `DevView` page routing.
- Added `monty` as a selectable dev sub-item in `ModeView` and sidebar `AppSidebar`.

## Flow

```mermaid
flowchart TD
    A[Open /dev/monty] --> B[MontyDevView mounts]
    B --> C[loadMonty()]
    C --> D{Runtime loaded?}
    D -->|Yes| E[Run basic Monty script probe]
    D -->|No| F[Show runtime error state]
    E --> G[Run external function probe]
    G --> H[Render probe outputs in ItemGroup rows]
```
