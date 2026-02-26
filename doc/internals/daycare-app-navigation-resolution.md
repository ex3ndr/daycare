# Daycare App Navigation Resolution

After upgrading Expo SDK 55, `expo-router` pins `@react-navigation/native@7.1.28`.
Using a newer app-level version (`7.1.31`) caused incompatible package layouts and context/runtime failures.

```mermaid
flowchart LR
    App["daycare-app"] --> Router["expo-router"]
    Router --> Pinned["@react-navigation/native 7.1.28 (pinned)"]
    App --> Mismatch["@react-navigation/native 7.1.31 (mismatch)"]
    Mismatch --> Error["Runtime failures / missing context"]
    Pinned --> Align["Align app dependency to 7.1.28"]
    Align --> Healthy["Expo Router + navigation stack load correctly"]
```
