# App Monty Web Wasm Resolution

## Summary

Web bundling failed after adding `react-native-monty` because Metro did not resolve `.wasm` assets by default.
The app now registers `wasm` in Metro asset extensions so Monty web runtime files resolve during bundling.

## Changes

- Updated `packages/daycare-app/metro.config.js` to add `wasm` to `config.resolver.assetExts`.

## Flow

```mermaid
flowchart TD
    A[Import react-native-monty web runtime] --> B[monty.wasi-browser.js requires monty.wasm32-wasi.wasm]
    B --> C{Metro knows wasm extension?}
    C -->|No| D[Bundling fails with unable to resolve wasm]
    C -->|Yes| E[Metro loads wasm as asset]
    E --> F[Web bundle succeeds]
```
