# Swarm Skill & Secret Management Tools

## Overview
Add three new capabilities:

1. **Skill eject** — Copy a personal skill to a user-specified sandbox path so it can be inspected or modified externally. Agent tool `skill_eject` + API endpoint `POST /skills/eject`.

2. **Install skill to a swarm** — Extend the existing `skill_add` tool with an optional `userId` parameter. When provided, the skill is installed to that user's (swarm's) personal skills directory instead of the caller's.

3. **Secrets copy** — Copy named secrets from the owner to a target swarm. Agent tool `secrets_copy` + API endpoint `POST /swarms/:nametag/secrets/copy`. Separate from skill install.

4. **Swarm secret management** — Extend existing `secret_add` and `secret_remove` tools with an optional `userId` parameter. When provided, operates on the target swarm's secrets instead of the caller's. API endpoints under `/swarms/:nametag/secrets/*`.

## Context
- Skills are stored per-user at `<usersDir>/<userId>/skills/personal/` as folders with `SKILL.md` frontmatter
- Swarms are child users (`isSwarm: true`, `parentUserId: ownerUserId`) with their own `UserHome`
- Secrets are stored at `<usersDir>/<userId>/secrets.json` and are user-scoped via `Context`
- The `Secrets` facade accepts a `ctx: Context` for all operations — swarm secrets use a swarm-scoped context
- The `Swarms` facade has `userHomeForUserId` to resolve a swarm's `UserHome`
- Existing tools: `skill_add` (install from sandbox path), `skill_remove` (remove personal), `secret_add`, `secret_remove`, `swarm_create`
- All mutation API endpoints use `POST` with action-based paths
- Existing `skill_add` tool reads skill from a sandbox path and copies to `skillsPersonalRoot`

## Development Approach
- **Testing approach**: Code first, then tests
- Complete each task fully before moving to the next
- Each task includes new/updated tests
- All tests must pass before starting next task
- Run lint after changes

## Testing Strategy
- Unit tests for all new pure functions
- Unit tests for tool execute logic where feasible (mock sandbox/toolContext)

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix

## Implementation Steps

### Task 1: Add `skill_eject` tool
- [ ] Create `packages/daycare/sources/engine/modules/tools/skillEjectToolBuild.ts`
  - Tool name: `skill_eject`
  - Params: `{ name: string, path: string }` — personal skill name and destination sandbox path
  - Logic:
    1. Find the named skill in `toolContext.skillsPersonalRoot` by scanning folders and matching `SKILL.md` frontmatter name (reuse pattern from `skillRemoveToolBuild`)
    2. Resolve the destination path via `toolContext.sandbox.resolve({ path })` to get host path
    3. Copy the entire skill folder to the destination host path
    4. Return `{ summary, skillName, status: "ejected" }`
  - `visibleByDefault`: foreground only
- [ ] Write tests for `skillEjectToolBuild` (success: skill copied to destination, error: skill not found, error: no personal root)
- [ ] Register the tool in the tool registration flow (same location as `skill_add` and `skill_remove`)
- [ ] Run tests — must pass before next task

### Task 2: Add `POST /skills/eject` API endpoint
- [ ] Create `packages/daycare/sources/api/routes/skills/skillsEject.ts`
  - Handler: `skillsEject({ personalRoot, skillName, destinationPath })`
  - Find personal skill by name, copy to destination path
  - Return `{ ok: true, skillName, status: "ejected" }`
- [ ] Add the route to `skillsRouteHandle` in `skillsRoutes.ts`
  - Match `POST /skills/eject`
  - Body: `{ name: string, path: string }`
  - Pass `personalRoot` from context (add to `SkillsRouteContext` if needed)
- [ ] Write tests for `skillsEject` handler (success, not found)
- [ ] Run tests — must pass before next task

### Task 3: Extend `skill_add` with optional `userId` param
- [ ] Modify `packages/daycare/sources/engine/modules/tools/skillAddToolBuild.ts`
  - Add optional param `userId: Type.Optional(Type.String())` — target user (swarm) to install the skill into
  - When `userId` is provided:
    1. Verify caller is owner
    2. Verify target user exists and is a swarm owned by the caller
    3. Resolve target user's `UserHome` via `userHomeForUserId(userId)`
    4. Use target's `skillsPersonal` as the destination instead of caller's `skillsPersonalRoot`
  - When not provided, behavior is unchanged (backward compatible)
- [ ] Update tests for `skillAddToolBuild` (existing tests still pass, new: install to swarm userId, error: not owner, error: swarm not found)
- [ ] Run tests — must pass before next task

### Task 4: Add `secrets_copy` tool
- [ ] Create `packages/daycare/sources/engine/modules/tools/secretsCopyToolBuild.ts`
  - Tool name: `secrets_copy`
  - Params: `{ userId: string, secrets: string[] }` — target swarm userId and list of owner secret names to copy
  - Logic:
    1. Verify caller is owner
    2. Verify target userId is a swarm owned by the caller
    3. Load named secrets from owner's secrets via `secrets.list(ownerCtx)`
    4. For each named secret, call `secrets.add(swarmCtx, secret)` with swarm-scoped context
    5. Return summary with copied secret names
  - `visibleByDefault`: foreground only
- [ ] Write tests for `secretsCopyToolBuild` (success, not owner, swarm not found, secret not found)
- [ ] Register the tool
- [ ] Run tests — must pass before next task

### Task 5: Extend `secret_add` and `secret_remove` with optional `userId` param
- [ ] Modify `packages/daycare/sources/engine/modules/tools/secretAddToolBuild.ts`
  - Add optional param `userId: Type.Optional(Type.String())` — target user (swarm) to manage secrets for
  - When `userId` is provided:
    1. Verify caller is owner
    2. Verify target user exists and is a swarm owned by the caller
    3. Build swarm-scoped `Context` (`{ userId }`)
    4. Call `secrets.add(swarmCtx, secret)` instead of using caller's context
  - When not provided, behavior is unchanged (backward compatible)
- [ ] Modify `packages/daycare/sources/engine/modules/tools/secretRemoveToolBuild.ts`
  - Add optional param `userId: Type.Optional(Type.String())` — same pattern
  - When `userId` is provided:
    1. Verify caller is owner
    2. Verify target user is a swarm owned by the caller
    3. Build swarm-scoped `Context`
    4. Call `secrets.remove(swarmCtx, name)`
  - When not provided, behavior is unchanged
- [ ] Update tests for both tools (existing tests still pass, new: operate on swarm userId, error: not owner, error: swarm not found)
- [ ] Run tests — must pass before next task

### Task 6: Add swarm routes and secrets API endpoints
- [ ] Create `packages/daycare/sources/api/routes/swarms/` directory
- [ ] Create `packages/daycare/sources/api/routes/swarms/swarmsRoutes.ts` — route dispatcher for `/swarms`
- [ ] Create `packages/daycare/sources/api/routes/swarms/swarmsSecretsList.ts`
  - `GET /swarms/:nametag/secrets` — list swarm's secrets (metadata only, no values)
- [ ] Create `packages/daycare/sources/api/routes/swarms/swarmsSecretsCopy.ts`
  - `POST /swarms/:nametag/secrets/copy` — copy named owner secrets to swarm
  - Body: `{ secrets: string[] }` — list of owner secret names
- [ ] Create `packages/daycare/sources/api/routes/swarms/swarmsSecretsCreate.ts`
  - `POST /swarms/:nametag/secrets/create` — create a secret on the swarm
- [ ] Create `packages/daycare/sources/api/routes/swarms/swarmsSecretsUpdate.ts`
  - `POST /swarms/:nametag/secrets/:name/update` — update a swarm secret
- [ ] Create `packages/daycare/sources/api/routes/swarms/swarmsSecretsDelete.ts`
  - `POST /swarms/:nametag/secrets/:name/delete` — delete a swarm secret
- [ ] Wire `swarmsRouteHandle` into `routes.ts` for `/swarms` prefix
- [ ] Write tests for each handler (success + error cases)
- [ ] Run tests — must pass before next task

### Task 7: Verify acceptance criteria
- [ ] Verify `skill_eject` copies a personal skill to a sandbox destination path
- [ ] Verify `skill_add` with `userId` installs skill to the swarm's personal skills
- [ ] Verify `secrets_copy` copies named secrets from owner to swarm
- [ ] Verify `secret_add` / `secret_remove` with `userId` operate on swarm's secrets
- [ ] Verify all API endpoints follow `POST` mutation convention
- [ ] Verify swarm secrets are fully independent from owner secrets
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`) — all issues must be fixed

### Task 8: [Final] Update documentation
- [ ] Add/update plugin or module README if applicable
- [ ] Document new tools in relevant knowledge files

## Technical Details

### Skill Eject Flow
```
Agent calls skill_eject({ name: "my-tool", path: "/workspace/skills" })
  → Scan skillsPersonalRoot for folder with matching SKILL.md name
  → Resolve destination via sandbox.resolve({ path })
  → Copy skill folder → resolved destination path
  → Return ejected confirmation
```

### Skill Add to Swarm Flow (extended skill_add)
```
Agent calls skill_add({ path: "/workspace/my-skill", userId: "swarm-user-id" })
  → Verify caller is owner
  → Verify userId is a swarm owned by caller
  → Resolve swarm's UserHome via userHomeForUserId(userId)
  → Read SKILL.md from sandbox path (existing logic)
  → Copy skill folder → swarmUserHome.skillsPersonal/<skillName>/
  → Return installed confirmation
```

### Secrets Copy Flow
```
Agent calls secrets_copy({ userId: "swarm-user-id", secrets: ["api-key", "db-creds"] })
  → Verify caller is owner
  → Verify userId is a swarm owned by caller
  → Load each named secret from owner's secrets
  → secrets.add(swarmCtx, secret) for each
  → Return copied confirmation with secret names
```

### Swarm Secret Flow (extended secret_add / secret_remove)
```
Agent calls secret_add({ name: "api-key", ..., userId: "swarm-user-id" })
  → Verify caller is owner
  → Verify userId is a swarm owned by caller
  → Build swarmCtx = { userId }
  → secrets.add(swarmCtx, { name, displayName, description, variables })
  → Secret saved at <usersDir>/<swarm.userId>/secrets.json

Agent calls secret_remove({ name: "api-key", userId: "swarm-user-id" })
  → Same owner/swarm verification
  → secrets.remove(swarmCtx, name)
```

### API Routes Structure
```
POST /skills/eject                             — eject personal skill to destination path
POST /swarms/:nametag/secrets/copy             — copy owner secrets to swarm
GET  /swarms/:nametag/secrets                  — list swarm secrets
POST /swarms/:nametag/secrets/create           — create swarm secret
POST /swarms/:nametag/secrets/:name/update     — update swarm secret
POST /swarms/:nametag/secrets/:name/delete     — delete swarm secret
```

## Post-Completion
**Manual verification:**
- Test skill eject with a real personal skill, verify the copy appears at the destination path
- Test skill_add with userId targeting a swarm, verify the skill appears in the swarm's agent context
- Test secrets_copy: copy owner secrets to swarm, verify they appear in swarm's secrets but owner's are unchanged
- Test swarm secrets end-to-end: create secret on swarm, verify it's available in swarm's exec sandbox but not in owner's
