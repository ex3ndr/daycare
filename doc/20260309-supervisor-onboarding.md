# Supervisor Onboarding Flow

Adds an onboarding screen that collects the user's mission and sends it to the supervisor agent for bootstrap processing.

## Flow

```mermaid
sequenceDiagram
    participant App
    participant API
    participant Supervisor

    App->>App: Check homeReady & bootstrapStarted flags
    alt bootstrapStarted = false
        App->>App: Show mission input form
        App->>API: POST /agents/supervisor/bootstrap {text}
        API->>Supervisor: Queue bootstrap message
        App->>API: POST /profile/update {configuration: {bootstrapStarted: true}}
        App->>App: Show "working" indicator
    else bootstrapStarted = true, homeReady = false
        App->>App: Show "working" indicator
    else homeReady = true
        App->>App: Show HomeView
    end
```

## Changes

### Backend
- Added `bootstrapStarted` flag to `UserConfiguration` type
- Updated normalization, validation, and schema defaults
- Added migration `20260309090000_user_configuration_bootstrap_started`
- Updated `userProfileUpdateTool` to support `bootstrapStarted` flag

### Frontend
- Created `supervisorBootstrap` API call module
- Created `configUpdate` API call module for updating configuration flags
- Rewrote `OnboardingView` with two states:
  - **Mission input**: text area + submit button (when `bootstrapStarted = false`)
  - **Working indicator**: activity spinner + status message (when `bootstrapStarted = true`)

## State Machine

| `homeReady` | `bootstrapStarted` | UI State |
|---|---|---|
| `false` | `false` | Mission input form |
| `false` | `true` | Working indicator |
| `true` | `*` | HomeView dashboard |
