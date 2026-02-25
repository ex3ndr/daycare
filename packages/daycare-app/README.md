# Daycare App

Expo app scaffold for Daycare (iOS/Android/Web) with a token-based magic-link auth flow.

## Development

1. Install deps from repo root:
   - `yarn install`
2. Start the web app:
   - `yarn workspace daycare-app web`
3. Start iOS/Android dev server:
   - `yarn workspace daycare-app ios`
   - `yarn workspace daycare-app android`

## Scripts

- `yarn workspace daycare-app start`
- `yarn workspace daycare-app web`
- `yarn workspace daycare-app ios`
- `yarn workspace daycare-app android`
- `yarn workspace daycare-app typecheck`
- `yarn workspace daycare-app test`

## Auth flow

- Open `/auth?token=<jwt>` from the app server link.
- The app calls `POST /auth/validate`.
- On success it stores the token in secure storage (native) or localStorage (web).
- App shell then renders the authenticated route group.
