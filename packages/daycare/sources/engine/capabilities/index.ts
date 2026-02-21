/**
 * Capabilities-based permission system.
 * 
 * This module provides a type-safe, composable permission model for Daycare.
 * 
 * @example
 * ```ts
 * import { PermissionSet, PermissionSetBuilder, Permissions } from "./capabilities";
 * 
 * // Create permissions using the builder
 * const permissions = PermissionSetBuilder.create("my-agent")
 *   .workspace("/home/user/.daycare/workspace")
 *   .network()
 *   .events()
 *   .write("/home/user/documents")
 *   .build();
 * 
 * // Or use convenience functions
 * const workspacePerms = Permissions.workspace("agent", "/path/to/workspace");
 * 
 * // Check permissions
 * const canWrite = await permissions.check({ kind: "file:write", path: "/some/path" });
 * 
 * // Audit permissions
 * const audit = permissions.audit();
 * console.log(audit.summary);
 * 
 * // Derive sandboxed permissions
 * const sandboxed = permissions.sandbox({ keepNetwork: false });
 * ```
 */

// Core types
export type {
  Capability,
  CapabilityAudit,
  CapabilityKind,
  CapabilityOfKind,
  EventsCapability,
  EventsCheck,
  FileReadCapability,
  FileReadCheck,
  FileWriteCapability,
  FileWriteCheck,
  NetworkCapability,
  NetworkCheck,
  PermissionAudit,
  PermissionCheck,
  PermissionCheckResult,
  PermissionSetConfig,
  SerializedPermissionSet
} from "./types.js";

// Permission checking
export {
  checkFileRead,
  checkFileReadSecure,
  checkFileWrite,
  checkFileWriteSecure,
  checkNetwork,
  checkPermission,
  checkPermissionSync,
  domainMatches,
  isPathWithin,
  isPathWithinSecure
} from "./permissionCheck.js";

// PermissionSet class
export { PermissionSet } from "./permissionSet.js";

// Builder pattern
export {
  DerivationBuilder,
  PermissionSetBuilder,
  Permissions
} from "./permissionSetBuilder.js";

// Legacy compatibility
export type {
  LegacyPermissionAccess,
  LegacySessionPermissions
} from "./legacy.js";

export {
  applyPermissionTags,
  buildDefaultPermissions,
  capabilityToLegacyAccess,
  createSandboxPermissions,
  formatPermissionTag,
  fromLegacyPermissions,
  legacyAccessToCapability,
  normalizePermissionTags,
  parsePermissionTag,
  parsePermissionTags,
  toLegacyPermissions
} from "./legacy.js";
