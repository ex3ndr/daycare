# Daycare App React Resolution via Nohoist

This repo now uses Yarn v1 `workspaces.nohoist` for `react`, `react-dom`, and `react-native`.
The goal is to keep app runtime dependencies local to each workspace and avoid mixed React versions in Metro.

```mermaid
flowchart TD
    Root["root node_modules"] --> Dashboard["packages/daycare-dashboard (react@18)"]
    Root --> App["packages/daycare-app (react@19)"]
    Nohoist["workspaces.nohoist"] --> AppLocal["daycare-app/node_modules/react@19"]
    Nohoist --> DashboardLocal["daycare-dashboard/node_modules/react@18"]
    AppLocal --> Metro["Expo Metro resolver"]
    Metro --> Runtime["Single React instance for daycare-app runtime"]
```
