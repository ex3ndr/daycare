# Permission System Redesign

## Overview

The new permission system introduces:
1. **Type-safe capability definitions** - Replace string tags with discriminated unions
2. **Clear hierarchy model** - Explicit permission inheritance (write implies read)
3. **Composable permission sets** - Named permission bundles for common patterns
4. **Permission auditing** - Easy introspection of effective permissions
5. **Capability-based security** - Permissions as unforgeable tokens

## Core Design Principles

### 1. Capabilities as First-Class Types

```typescript
// Atomic capabilities - the building blocks
type NetworkCapability = {
  readonly kind: "network";
  readonly domains?: readonly string[];  // Optional domain restrictions
};

type EventsCapability = {
  readonly kind: "events";
  readonly socketPath?: string;  // Specific socket
};

type FileReadCapability = {
  readonly kind: "file:read";
  readonly path: string;
  readonly recursive: boolean;
};

type FileWriteCapability = {
  readonly kind: "file:write";
  readonly path: string;
  readonly recursive: boolean;
};

type Capability =
  | NetworkCapability
  | EventsCapability
  | FileReadCapability
  | FileWriteCapability;
```

### 2. Permission Sets with Inheritance

```typescript
// A PermissionSet bundles capabilities with automatic inheritance
interface PermissionSet {
  readonly id: string;
  readonly label: string;
  readonly capabilities: readonly Capability[];
  
  // Computed: effective capabilities including inherited ones
  readonly effective: () => readonly Capability[];
  
  // Audit: human-readable description
  readonly describe: () => string;
  
  // Check: does this set allow a specific action?
  readonly allows: (action: PermissionCheck) => boolean;
}
```

### 3. Permission Builder Pattern

```typescript
// Fluent builder for constructing permission sets
const permissions = PermissionSetBuilder.create("agent-workspace")
  .withWorkspace("/home/user/.daycare/workspace")
  .allowNetwork()
  .allowEvents()
  .allowWrite("/home/user/documents")
  .allowRead("/home/user/downloads")
  .build();

// Immutable extension
const extended = permissions.extend()
  .allowWrite("/tmp")
  .build();
```

### 4. Permission Derivation (Least Privilege)

```typescript
// Derive a restricted permission set for subprocess/subagent
const sandboxed = permissions.derive()
  .revokeNetwork()
  .restrictWrite(["/tmp"])  // Only keep /tmp from parent writes
  .build();
```

### 5. Clear Auditing

```typescript
permissions.audit();
// Returns:
// {
//   network: { allowed: true, domains: ["*"] },
//   events: { allowed: true },
//   read: [
//     { path: "/home/user/.daycare/workspace", recursive: true, source: "workspace" },
//     { path: "/home/user/downloads", recursive: true, source: "explicit" }
//   ],
//   write: [
//     { path: "/home/user/.daycare/workspace", recursive: true, source: "workspace" },
//     { path: "/home/user/documents", recursive: true, source: "explicit" }
//   ],
//   effective: [
//     "Read any file",
//     "Write to workspace and /home/user/documents",
//     "Network access (all domains)",
//     "Events socket access"
//   ]
// }
```

## Implementation Plan

### Phase 1: Core Types (capabilities.ts)
- Define Capability discriminated union
- Define PermissionSet interface
- Define permission checking types

### Phase 2: Permission Set Implementation (permissionSet.ts)
- PermissionSetImpl class
- Inheritance logic (write implies read)
- Path containment checking

### Phase 3: Builder Pattern (permissionSetBuilder.ts)
- PermissionSetBuilder for fluent construction
- DerivationBuilder for creating restricted sets

### Phase 4: Migration Layer (legacy.ts)
- Convert SessionPermissions to PermissionSet
- Convert PermissionSet to SessionPermissions (for backward compat)
- Parse legacy string tags to capabilities

### Phase 5: Integration
- Update tools to use new system
- Update agent state to use PermissionSet
- Update sandbox config building

## File Structure

```
packages/daycare/sources/engine/capabilities/
├── index.ts                    # Re-exports
├── types.ts                    # Core capability types
├── permissionSet.ts           # PermissionSet implementation
├── permissionSetBuilder.ts    # Builder pattern
├── permissionCheck.ts         # Permission checking logic
├── permissionAudit.ts         # Auditing utilities
├── legacy.ts                  # Migration from string tags
└── __tests__/
    ├── types.spec.ts
    ├── permissionSet.spec.ts
    ├── permissionSetBuilder.spec.ts
    └── permissionCheck.spec.ts
```

## Key Improvements

1. **Type Safety**: No more string parsing - capabilities are typed unions
2. **Explicit Hierarchy**: `file:write` capability carries implicit `file:read` 
3. **Immutability**: PermissionSets are immutable, derivation creates new sets
4. **Auditability**: `audit()` method gives complete visibility
5. **Composability**: Builder pattern allows easy construction and extension
6. **Testability**: Pure functions, no global state
