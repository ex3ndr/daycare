# iOS LocalStorage Runtime Guard

## Summary

Fixed app startup crash on iOS caused by theme persistence reading `window.localStorage` when `window` exists but `localStorage` is unavailable.

## Root Cause

- `loadThemePreference()` treated `window` availability as equivalent to browser storage availability.
- On React Native iOS, `window` can exist while `window.localStorage` is `undefined`.
- Startup theme bootstrap called `window.localStorage.getItem(...)`, causing:
  - `TypeError: Cannot read property 'getItem' of undefined`

## Changes

- Added guarded storage access in `sources/modules/state/persistence.ts`.
- Added regression tests in `sources/modules/state/persistence.spec.ts` for:
  - no `window`;
  - no `localStorage`;
  - valid stored value;
  - storage access throwing.

## Flow

```mermaid
flowchart TD
    A[loadThemePreference] --> B{window exists?}
    B -- no --> C[return adaptive]
    B -- yes --> D{localStorage.getItem available?}
    D -- no --> C
    D -- yes --> E[try getItem]
    E --> F{value valid light/dark/adaptive?}
    F -- yes --> G[return stored value]
    F -- no --> C
    E -->|throws| C
```
