# Secrets Engine

The secrets engine stores reusable, user-scoped environment variable bundles in:

`<usersDir>/<encodeURIComponent(userId)>/secrets.json`

## Components

- `secretTypes.ts`: canonical `Secret` shape (`name`, `displayName`, `description`, `variables`)
- `secretLoad.ts`: load + validate `secrets.json` (returns `[]` when file is missing)
- `secretSave.ts`: atomic save via temp file + rename
- `secretValidateName.ts`: kebab-case secret name validation
- `secrets.ts`: `Secrets` facade (`list`, `add`, `remove`, `resolve`)

## Runtime Usage

- `secret_add` and `secret_remove` tools mutate secret definitions.
- `exec` accepts `secrets: string[]` and resolves names through `Secrets.resolve(...)`.
- Resolved secret env vars have highest precedence:
  `process.env -> dotenv -> explicit env -> secrets`
- `topology` exposes only secret metadata (name/displayName/description/variable names), never values.
