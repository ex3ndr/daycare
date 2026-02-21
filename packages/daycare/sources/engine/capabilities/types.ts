/**
 * Core capability types for the permission system.
 * 
 * Capabilities are unforgeable tokens representing specific permissions.
 * They use discriminated unions for type-safe handling.
 */

/**
 * Network access capability.
 * When domains is undefined or empty, all domains are allowed.
 */
export type NetworkCapability = {
  readonly kind: "network";
  readonly domains?: readonly string[];
};

/**
 * Events socket access capability.
 * Allows connection to the Daycare CLI control endpoint.
 */
export type EventsCapability = {
  readonly kind: "events";
};

/**
 * File read capability.
 * When recursive is true, includes all subdirectories.
 */
export type FileReadCapability = {
  readonly kind: "file:read";
  readonly path: string;
  readonly recursive: boolean;
};

/**
 * File write capability.
 * When recursive is true, includes all subdirectories.
 * Note: Write capability implies read capability for the same path.
 */
export type FileWriteCapability = {
  readonly kind: "file:write";
  readonly path: string;
  readonly recursive: boolean;
};

/**
 * Union of all capability types.
 */
export type Capability =
  | NetworkCapability
  | EventsCapability
  | FileReadCapability
  | FileWriteCapability;

/**
 * Kind discriminator for capabilities.
 */
export type CapabilityKind = Capability["kind"];

/**
 * Extract capability type by kind.
 */
export type CapabilityOfKind<K extends CapabilityKind> = Extract<
  Capability,
  { kind: K }
>;

/**
 * Permission check request for network access.
 */
export type NetworkCheck = {
  readonly kind: "network";
  readonly domain?: string;
};

/**
 * Permission check request for events access.
 */
export type EventsCheck = {
  readonly kind: "events";
};

/**
 * Permission check request for file read.
 */
export type FileReadCheck = {
  readonly kind: "file:read";
  readonly path: string;
};

/**
 * Permission check request for file write.
 */
export type FileWriteCheck = {
  readonly kind: "file:write";
  readonly path: string;
};

/**
 * Union of all permission check types.
 */
export type PermissionCheck =
  | NetworkCheck
  | EventsCheck
  | FileReadCheck
  | FileWriteCheck;

/**
 * Result of a permission check.
 */
export type PermissionCheckResult = {
  readonly allowed: boolean;
  readonly reason: string;
  readonly capability?: Capability;
};

/**
 * Audit information for a single capability.
 */
export type CapabilityAudit = {
  readonly capability: Capability;
  readonly source: "explicit" | "workspace" | "inherited" | "default";
  readonly description: string;
};

/**
 * Complete audit of a permission set.
 */
export type PermissionAudit = {
  readonly id: string;
  readonly label: string;
  readonly workspacePath: string | null;
  readonly network: {
    readonly allowed: boolean;
    readonly domains: readonly string[] | "all";
  };
  readonly events: {
    readonly allowed: boolean;
  };
  readonly read: readonly {
    readonly path: string;
    readonly recursive: boolean;
    readonly source: CapabilityAudit["source"];
  }[];
  readonly write: readonly {
    readonly path: string;
    readonly recursive: boolean;
    readonly source: CapabilityAudit["source"];
  }[];
  readonly summary: readonly string[];
};

/**
 * Configuration for creating a PermissionSet.
 */
export type PermissionSetConfig = {
  readonly id: string;
  readonly label?: string;
  readonly workspacePath?: string;
  readonly capabilities?: readonly Capability[];
  readonly parent?: PermissionSetConfig;
};

/**
 * Serializable representation of a PermissionSet for storage/transmission.
 */
export type SerializedPermissionSet = {
  readonly id: string;
  readonly label: string;
  readonly workspacePath: string | null;
  readonly capabilities: readonly Capability[];
};
