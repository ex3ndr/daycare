# App Slot Workspace Remount

The desktop and mobile app shells render Expo Router's `Slot` inside the `(app)` layout.

Keying that `Slot` by `activeId` remounted the layout navigator whenever the workspace store changed. On web, Expo Router 55 and React Navigation 7 could then rebuild the nested navigator with incomplete state, which surfaced as:

- `TypeError: Cannot read properties of undefined (reading 'stale')`
- stack frames in `Navigator.js`, `ModalStack`, and `SlotNavigator`

The fix is to let Expo Router own the `Slot` lifecycle and remount at the route level instead:

- the `(app)` shell now uses an explicit `Navigator`
- the `[workspace]` route gets a workspace-derived `dangerouslySingular` id
- switching workspaces recreates the `[workspace]` subtree without tearing down the layout navigator

```mermaid
flowchart LR
    A[workspace store activeId changes] --> B[keyed Slot remounts]
    B --> C[Expo Router layout navigator recreated]
    C --> D[React Navigation reads partial state]
    D --> E[stale undefined crash]
    A --> F[Navigator keeps layout alive]
    F --> G[[workspace] route gets singular id]
    G --> H[workspace subtree remounts cleanly]
```
