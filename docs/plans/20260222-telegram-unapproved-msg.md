# Telegram: Unapproved User Message & Public Mode

## Overview
- When an unapproved user messages the Telegram bot in private mode, send them a rejection message instead of silently ignoring
- Add a `mode: "public" | "private"` setting; when `"public"`, all users are allowed (no allowlist check)
- Make `allowedUids` optional when mode is `"public"`

## Context
- **connector.ts** (lines 113-118): currently silently returns for unapproved UIDs
- **connector.ts** (line 75): `allowedUids: Set<string>` used for checks
- **connector.ts** (lines 550-555): `isAllowedUid()` method
- **plugin.ts** (lines 10-20): settings schema requires `allowedUids` with `.min(1)`
- **plugin.ts** (lines 87-101): onboarding prompts for UIDs

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**

## Implementation Steps

### Task 1: Add `mode` to settings schema and connector options
- [ ] In `plugin.ts`: add `mode: z.enum(["public", "private"]).default("private")` to `settingsSchema`
- [ ] In `plugin.ts`: make `allowedUids` conditionally optional via `.superRefine()` — require min 1 when mode is `"private"`, allow empty/missing when `"public"`
- [ ] In `connector.ts`: add `mode?: "public" | "private"` to `TelegramConnectorOptions`
- [ ] In `connector.ts`: store `this.mode` in constructor (default `"private"`)
- [ ] Write tests for settings schema validation (public mode without UIDs, private mode requires UIDs)
- [ ] Run tests — must pass before next task

### Task 2: Send rejection message to unapproved users
- [ ] In `connector.ts` (lines 113-118): when `isAllowedUid` returns false **and** mode is `"private"`, send a message: `"🚫 You are not authorized to use this bot. Please contact the system administrator to request access."` via `this.bot.sendMessage(chatId, ...)`
- [ ] Update `isAllowedUid` to return `true` when `this.mode === "public"` (skip allowlist check entirely)
- [ ] Write tests for rejection message behavior (unapproved user in private mode gets message, public mode allows all)
- [ ] Run tests — must pass before next task

### Task 3: Update onboarding flow
- [ ] In `plugin.ts` `onboarding`: prompt for mode selection before prompting for UIDs
- [ ] Skip `allowedUids` prompt when mode is `"public"`
- [ ] Write tests for onboarding flow changes
- [ ] Run tests — must pass before next task

### Task 4: Verify acceptance criteria
- [ ] Verify: unapproved user in private mode receives rejection message with emoji
- [ ] Verify: public mode skips allowlist entirely
- [ ] Verify: private mode still requires at least one UID in schema
- [ ] Verify: public mode allows empty/missing `allowedUids`
- [ ] Run full test suite (`yarn test`)
- [ ] Run linter (`yarn lint`)

### Task 5: [Final] Update documentation
- [ ] Update `packages/daycare/sources/plugins/telegram/README.md` with new `mode` setting
- [ ] Update `doc/connectors/telegram.md` with public/private mode docs

## Technical Details

**Settings schema change:**
```typescript
const settingsSchema = z
    .object({
        mode: z.enum(["public", "private"]).default("private"),
        allowedUids: z.array(allowedUidSchema).optional().default([])
            .transform((values) => Array.from(new Set(values.map((value) => String(value))))),
        // ... rest unchanged
    })
    .superRefine((data, ctx) => {
        if (data.mode === "private" && data.allowedUids.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.too_small,
                minimum: 1,
                type: "array",
                inclusive: true,
                message: "allowedUids must have at least 1 entry in private mode",
                path: ["allowedUids"]
            });
        }
    });
```

**Connector changes:**
```typescript
// In constructor
this.mode = options.mode ?? "private";

// In isAllowedUid
if (this.mode === "public") return true;

// In message handler (unapproved path)
await this.bot.sendMessage(
    String(message.chat.id),
    "🚫 You are not authorized to use this bot. Please contact the system administrator to request access."
);
```
