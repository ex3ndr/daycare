# Synchronous Permission Requests with Timeout

## Overview
Convert the `request_permission` tool from an async fire-and-forget pattern to a synchronous blocking call with a configurable timeout. Currently the tool returns immediately with "Permission request sent" and relies on an async inbox-based flow (permission inbox item → `handlePermission` → resume message) to deliver the user's decision back to the agent. After this change, the tool blocks until the user responds (or timeout expires), then returns the decision directly as the tool result — just like any other tool call.

- **Problem**: The async flow requires the model to "come back" via a resume message, adding latency, complexity, and a disjointed UX where the model must re-orient after receiving the resume.
- **Benefit**: Simpler mental model for the LLM, direct tool result with approval/denial, cleaner code path.
- **Integration**: The connector UI (Telegram buttons, WhatsApp text) stays identical. Only the wiring between tool ↔ engine ↔ agent changes.

## Context
- **Permission tool**: `packages/daycare/sources/engine/modules/tools/permissions.ts` — `buildPermissionRequestTool()`
- **Agent handler**: `packages/daycare/sources/engine/agents/agent.ts` — `handlePermission()` (lines 778–829)
- **Engine wiring**: `packages/daycare/sources/engine/engine.ts` — `onPermission` callback (lines 171–203)
- **Inbox types**: `packages/daycare/sources/engine/agents/ops/agentTypes.ts` — `AgentInboxPermission`, `AgentInboxResult` permission variant
- **Connector types**: `packages/daycare/sources/engine/modules/connectors/types.ts` — `PermissionRequest`, `PermissionDecision`, `PermissionHandler`, `Connector` interface
- **Telegram connector**: `packages/daycare/sources/plugins/telegram/connector.ts` — `pendingPermissions`, `requestPermission()`, callback_query handler
- **WhatsApp connector**: `packages/daycare/sources/plugins/whatsapp/connector.ts` — `pendingPermissions`, `requestPermission()`, text-based approval
- **Tool types**: `packages/daycare/sources/engine/modules/tools/types.ts` — `ToolExecutionContext`

## Development Approach
- **Testing approach**: Regular (code first, then tests)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility for connector implementations (Telegram/WhatsApp stay the same)

## Testing Strategy
- **Unit tests**: required for every task
- Test the registry (register, resolve, reject, timeout, cleanup)
- Test the tool's synchronous blocking behavior with mocked registry
- Test engine wiring resolves the registry

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with ➕ prefix
- Document issues/blockers with ⚠️ prefix
- Update plan if implementation deviates from original scope
- ⚠️ `packages/daycare/sources/prompts/ACTORS.md` and `doc/PLUGINS.md` are not present in this checkout; documentation updates are applied to this plan and existing code-adjacent docs/tests instead.

## Implementation Steps

### Task 1: Create the permission request registry
Create `packages/daycare/sources/engine/modules/tools/permissionRequestRegistry.ts` — a shared registry that maps tokens to Promise resolvers, enabling the tool to block and the engine's `onPermission` to resolve.

- [x] Create `PermissionRequestRegistry` with a `Map<string, { resolve, reject, timer }>` backing store
- [x] Implement `register(token: string, timeoutMs: number): Promise<PermissionDecision>` — creates a Promise, stores its resolver, starts a timeout timer that rejects on expiry, returns the Promise
- [x] Implement `resolve(token: string, decision: PermissionDecision): boolean` — resolves the pending Promise and clears the timer; returns false if token not found
- [x] Implement `cancel(token: string): void` — rejects with cancellation error and cleans up
- [x] Write tests for register + resolve (happy path: decision delivered before timeout)
- [x] Write tests for register + timeout (Promise rejects after timeout)
- [x] Write tests for resolve with unknown token (returns false, no crash)
- [x] Write tests for cancel (rejects with cancellation error)
- [x] Run tests — must pass before next task

### Task 2: Make `request_permission` tool synchronous
Modify `buildPermissionRequestTool()` in `permissions.ts` to block on the registry Promise instead of returning immediately.

- [x] Add optional `timeout_minutes` parameter to the tool schema (default: 15, min: 1, max: 60)
- [x] Accept registry instance via `ToolExecutionContext` (add `permissionRequestRegistry` field to `ToolExecutionContext` in `types.ts`)
- [x] After sending the request to the connector, call `registry.register(token, timeoutMs)` and `await` the returned Promise
- [x] On approval: apply the permission to the agent's state (move `permissionApply` + `agentStateWrite` + event emit logic from `handlePermission` into the tool's post-resolve path)
- [x] Return tool result with "Permission granted for X" or "Permission denied for X" (matching existing message format)
- [x] On timeout: return an error tool result with "Permission request timed out after N minutes"
- [x] Keep the background-agent notice to foreground agent (existing lines 137–153)
- [x] Update existing permission tool tests for the new synchronous behavior
- [x] Write tests for timeout scenario
- [x] Run tests — must pass before next task

### Task 3: Wire registry into engine and update `onPermission`
Connect the registry so the engine's `onPermission` callback resolves pending promises instead of posting to the agent inbox.

- [x] Instantiate `PermissionRequestRegistry` in `engine.ts` and store it as a field
- [x] Pass registry into tool execution context (in `agentLoopRun.ts` where `ToolExecutionContext` is constructed)
- [x] Modify `onPermission` callback in `engine.ts`: call `registry.resolve(token, decision)` — if it returns true (found), skip inbox posting; if false (not found, stale), log a warning
- [x] Keep the foreground notification for background-agent permissions (existing lines 176–196 in engine.ts) — this still fires regardless
- [x] Write tests for engine wiring (registry.resolve called on permission callback)
- [x] Run tests — must pass before next task

### Task 4: Remove dead async permission flow
Clean up the async permission handling code that is no longer needed.

- [x] Remove `handlePermission()` method from `agent.ts`
- [x] Remove the `case "permission"` branch from `handleInboxItem()` in `agent.ts`
- [x] Remove `"permission"` from `sleepAfterItem()` type check in `agent.ts`
- [x] Remove `AgentInboxPermission` type alias from `agentTypes.ts`
- [x] Remove the `{ type: "permission"; ok: boolean }` variant from `AgentInboxResult` in `agentTypes.ts`
- [x] Remove the `{ type: "permission"; decision: PermissionDecision; context: MessageContext }` variant from `AgentInboxItem` in `agentTypes.ts`
- [x] Remove unused imports in `agent.ts` (`permissionApply`, `permissionDescribeDecision`, `permissionFormatTag` if no longer used elsewhere)
- [x] Verify no other code references the removed types/methods (grep for `AgentInboxPermission`, `handlePermission`, `type: "permission"` in inbox context)
- [x] Run tests — must pass before next task

### Task 5: Verify acceptance criteria
- [x] Verify: `request_permission` blocks until user responds or timeout
- [x] Verify: timeout defaults to 15 minutes, model can pass `timeout_minutes` (1–60)
- [x] Verify: timeout returns error (not denial)
- [x] Verify: approval applies permission and returns success message
- [x] Verify: denial returns denial message
- [x] Verify: background agent permissions still notify foreground agent
- [x] Verify: connector UI (Telegram buttons, WhatsApp text) unchanged
- [x] Run full test suite (`yarn test`)
- [x] Run typecheck (`yarn typecheck`)
- [x] Run linter if available (N/A: no `lint` script in workspace package scripts)

### Task 6: [Final] Update documentation
- [x] Update `doc/PLUGINS.md` if permission request interface changed (N/A: connector permission interface unchanged; file path not present in this checkout)
- [x] Update ACTORS.md if signal/event wiring changed (N/A: no actor/signal topology change; file path not present in this checkout)

## Technical Details

### Permission Request Registry
```typescript
// permissionRequestRegistry.ts
type PendingEntry = {
  resolve: (decision: PermissionDecision) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class PermissionRequestRegistry {
  private pending = new Map<string, PendingEntry>();

  register(token: string, timeoutMs: number): Promise<PermissionDecision> { ... }
  resolve(token: string, decision: PermissionDecision): boolean { ... }
  cancel(token: string): void { ... }
}
```

### Tool Schema Change
```typescript
const schema = Type.Object({
  permission: Type.String({ minLength: 1 }),
  reason: Type.String({ minLength: 1 }),
  agentId: Type.Optional(Type.String({ minLength: 1 })),
  timeout_minutes: Type.Optional(Type.Number({ minimum: 1, maximum: 60, default: 15 }))
}, { additionalProperties: false });
```

### Flow After Change
```
Agent calls request_permission(permission, reason, timeout_minutes?)
  ├─ Tool sends UI prompt to connector (unchanged)
  ├─ Tool registers token in PermissionRequestRegistry
  ├─ Tool awaits Promise (blocks tool execution)
  │
  │   ... user clicks allow/deny in Telegram/WhatsApp ...
  │
  ├─ Connector fires onPermission handler
  ├─ Engine's onPermission calls registry.resolve(token, decision)
  ├─ Promise resolves → tool gets PermissionDecision
  ├─ If approved: tool applies permission to agent state
  └─ Tool returns result: "Permission granted/denied for X"
```

### Timeout Flow
```
  ├─ Registry timer fires after timeout_minutes
  ├─ Promise rejects with timeout error
  └─ Tool returns error result: "Permission request timed out after N minutes"
```

## Post-Completion

**Manual verification:**
- Test with Telegram connector: request permission, click Allow → verify tool returns success
- Test with Telegram connector: request permission, click Deny → verify tool returns denial
- Test with Telegram connector: request permission, wait 15+ min → verify timeout error
- Test with WhatsApp connector: same scenarios
- Test background agent permission flow: verify foreground agent still gets notification
