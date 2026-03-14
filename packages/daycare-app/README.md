# Daycare App

Expo app scaffold for Daycare (iOS/Android/Web) with email-code sign-in plus token-based `/verify` links for app entry flows.

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

- Welcome screen email flow:
  - Enter an email address.
  - App calls `POST <backendUrl>/auth/email/request`.
  - Server emails a 6-digit code.
  - User enters the code in the app.
  - App calls `POST <backendUrl>/auth/email/verify` with `{ email, code }`.
  - On success it stores `{ baseUrl, token }` in secure storage (native) or localStorage (web).
- `/verify#<base64url-json>` flow:
  - Used for signed `/app` links and email-connect links.
  - Hash payload JSON contains `backendUrl`, `token`, and optional `kind`.
  - The app calls `POST <backendUrl>/auth/validate` for session links or `POST <backendUrl>/auth/email/connect/verify` for email-connect links.
