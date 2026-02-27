# User Profile Update Tool

This change introduces structured user profile fields in storage and a core tool to update them.

## What Changed

- Added nullable user profile columns in storage:
  - `users.first_name`
  - `users.last_name`
  - `users.country`
- Added migration `20260227_user_profile` to apply the new columns to existing databases.
- Added core tool `user_profile_update` for foreground user agents.
- Extended runtime user API (`GET /v1/engine/users`) to include `firstName`, `lastName`, and `country`.
- Updated environment prompt identity rendering to include structured profile fields when available.

## Data Flow

```mermaid
sequenceDiagram
    participant A as Foreground Agent
    participant T as user_profile_update
    participant U as UsersRepository
    participant DB as users table

    A->>T: user_profile_update({ firstName, lastName?, country? })
    T->>U: update(ctx.userId, UpdateUserInput)
    U->>DB: UPDATE users SET first_name,last_name,country,updated_at
    T->>U: findById(ctx.userId)
    U->>DB: SELECT * FROM users WHERE id=?
    U-->>T: structured profile row
    T-->>A: typedResult { firstName, lastName, country, nametag }
```
