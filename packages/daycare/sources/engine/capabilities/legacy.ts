import path from "node:path";

import type { Capability, FileWriteCapability } from "./types.js";
import { PermissionSet } from "./permissionSet.js";
import { PermissionSetBuilder } from "./permissionSetBuilder.js";

/**
 * Legacy SessionPermissions type (from the old system).
 */
export type LegacySessionPermissions = {
  workingDir: string;
  writeDirs: string[];
  readDirs: string[];
  network: boolean;
  events: boolean;
};

/**
 * Legacy PermissionAccess type (from the old system).
 */
export type LegacyPermissionAccess =
  | { kind: "network" }
  | { kind: "events" }
  | { kind: "read"; path: string }
  | { kind: "write"; path: string };

/**
 * Parse a legacy permission tag string into a capability.
 * 
 * Supported formats:
 * - @network
 * - @events
 * - @read:/path/to/dir
 * - @write:/path/to/dir
 * 
 * @throws Error if tag format is invalid
 */
export function parsePermissionTag(tag: string): Capability {
  const trimmed = tag.trim();

  if (trimmed === "@network") {
    return { kind: "network" };
  }

  if (trimmed === "@events") {
    return { kind: "events" };
  }

  if (trimmed.startsWith("@read:")) {
    const pathValue = trimmed.slice("@read:".length).trim();
    if (!pathValue) {
      throw new Error("Read permission requires a path.");
    }
    return {
      kind: "file:read",
      path: path.resolve(pathValue),
      recursive: true
    };
  }

  if (trimmed.startsWith("@write:")) {
    const pathValue = trimmed.slice("@write:".length).trim();
    if (!pathValue) {
      throw new Error("Write permission requires a path.");
    }
    return {
      kind: "file:write",
      path: path.resolve(pathValue),
      recursive: true
    };
  }

  throw new Error(
    "Permission must be @network, @events, @read:<path>, or @write:<path>."
  );
}

/**
 * Parse multiple permission tags into capabilities.
 * Silently skips invalid tags.
 */
export function parsePermissionTags(tags: readonly string[]): Capability[] {
  const capabilities: Capability[] = [];
  for (const tag of tags) {
    try {
      capabilities.push(parsePermissionTag(tag));
    } catch {
      // Skip invalid tags
    }
  }
  return capabilities;
}

/**
 * Format a capability as a legacy permission tag.
 */
export function formatPermissionTag(capability: Capability): string {
  switch (capability.kind) {
    case "network":
      return "@network";
    case "events":
      return "@events";
    case "file:read":
      return `@read:${capability.path}`;
    case "file:write":
      return `@write:${capability.path}`;
  }
}

/**
 * Convert a LegacyPermissionAccess to a Capability.
 */
export function legacyAccessToCapability(
  access: LegacyPermissionAccess
): Capability {
  switch (access.kind) {
    case "network":
      return { kind: "network" };
    case "events":
      return { kind: "events" };
    case "read":
      return { kind: "file:read", path: path.resolve(access.path), recursive: true };
    case "write":
      return { kind: "file:write", path: path.resolve(access.path), recursive: true };
  }
}

/**
 * Convert a Capability to a LegacyPermissionAccess.
 */
export function capabilityToLegacyAccess(
  capability: Capability
): LegacyPermissionAccess {
  switch (capability.kind) {
    case "network":
      return { kind: "network" };
    case "events":
      return { kind: "events" };
    case "file:read":
      return { kind: "read", path: capability.path };
    case "file:write":
      return { kind: "write", path: capability.path };
  }
}

/**
 * Convert LegacySessionPermissions to a PermissionSet.
 */
export function fromLegacyPermissions(
  legacy: LegacySessionPermissions,
  id: string = "converted"
): PermissionSet {
  const builder = PermissionSetBuilder.create(id)
    .workspace(legacy.workingDir);

  // Add network if enabled
  if (legacy.network) {
    builder.network();
  }

  // Add events if enabled
  if (legacy.events) {
    builder.events();
  }

  // Add explicit write directories (workspace is already added)
  for (const dir of legacy.writeDirs) {
    const resolved = path.resolve(dir);
    // Skip if it's the workspace (already added)
    if (resolved !== path.resolve(legacy.workingDir)) {
      builder.write(resolved);
    }
  }

  // Add explicit read directories
  for (const dir of legacy.readDirs) {
    const resolved = path.resolve(dir);
    // Skip if already covered by write
    const coveredByWrite =
      resolved === path.resolve(legacy.workingDir) ||
      legacy.writeDirs.some(
        (w) =>
          resolved === path.resolve(w) ||
          resolved.startsWith(path.resolve(w) + path.sep)
      );
    if (!coveredByWrite) {
      builder.read(resolved);
    }
  }

  return builder.build();
}

/**
 * Convert a PermissionSet back to LegacySessionPermissions.
 * This is for backward compatibility with existing code.
 */
export function toLegacyPermissions(
  permissions: PermissionSet
): LegacySessionPermissions {
  const writeCaps = permissions.writeCapabilities;
  const readCaps = permissions.capabilities.filter(
    (c): c is { kind: "file:read"; path: string; recursive: boolean } =>
      c.kind === "file:read"
  );

  // Determine workingDir from workspace or first write dir
  const workingDir = permissions.workspacePath ?? writeCaps[0]?.path ?? process.cwd();

  // Collect all write dirs
  const writeDirs = writeCaps.map((c) => c.path);

  // Collect explicit read dirs (not implied by write)
  const readDirs = readCaps
    .filter(
      (r) =>
        !writeDirs.some(
          (w) => r.path === w || r.path.startsWith(w + path.sep)
        )
    )
    .map((c) => c.path);

  return {
    workingDir,
    writeDirs: dedupeStrings(writeDirs),
    readDirs: dedupeStrings(readDirs),
    network: permissions.hasNetwork,
    events: permissions.hasEvents
  };
}

/**
 * Apply permission tags to a PermissionSet, returning a new PermissionSet.
 * Only applies tags that are already allowed by the source permissions.
 * 
 * @throws Error if any tag is not allowed
 */
export function applyPermissionTags(
  source: PermissionSet,
  tags: readonly string[]
): PermissionSet {
  const capabilities = parsePermissionTags(tags);
  
  // Validate that each capability is allowed by source
  for (const cap of capabilities) {
    if (cap.kind === "network" && !source.hasNetwork) {
      throw new Error("Cannot attach @network - you don't have it.");
    }
    if (cap.kind === "events" && !source.hasEvents) {
      throw new Error("Cannot attach @events - you don't have it.");
    }
    if (cap.kind === "file:write") {
      const check = source.checkSync({ kind: "file:write", path: cap.path });
      if (!check.allowed) {
        throw new Error(`Cannot attach @write:${cap.path} - you don't have it.`);
      }
    }
    // Note: @read tags are typically ignored in exec context
  }

  return source.extend(capabilities);
}

/**
 * Build default permissions for an agent session.
 */
export function buildDefaultPermissions(
  workingDir: string,
  configDir: string,
  memoryPaths: readonly string[] = []
): PermissionSet {
  const builder = PermissionSetBuilder.create("default")
    .withLabel("Default Agent Permissions")
    .workspace(workingDir);

  // Add heartbeat and skills directories
  if (configDir) {
    builder
      .write(path.resolve(configDir, "heartbeat"))
      .write(path.resolve(configDir, "skills"));
  }

  // Add memory paths
  for (const memPath of memoryPaths) {
    builder.write(path.resolve(memPath));
  }

  return builder.build();
}

/**
 * Create sandbox permissions for exec tool.
 * Starts with no network, no events, and optionally restricted writes.
 */
export function createSandboxPermissions(
  source: PermissionSet,
  requestedTags?: readonly string[]
): PermissionSet {
  // Start with an empty permission set
  let sandbox = PermissionSet.empty("sandbox");

  if (!requestedTags || requestedTags.length === 0) {
    // No permissions requested - return empty
    return PermissionSet.create({
      id: "sandbox",
      workspacePath: source.workspacePath ?? undefined,
      capabilities: []
    });
  }

  // Parse requested tags
  const capabilities = parsePermissionTags(requestedTags);

  // Filter out @read tags (not supported in exec)
  const nonReadCaps = capabilities.filter((c) => c.kind !== "file:read");

  // Validate that each capability is allowed by source
  for (const cap of nonReadCaps) {
    if (cap.kind === "network" && !source.hasNetwork) {
      throw new Error("Cannot attach @network - you don't have it.");
    }
    if (cap.kind === "events" && !source.hasEvents) {
      throw new Error("Cannot attach @events - you don't have it.");
    }
    if (cap.kind === "file:write") {
      const check = source.checkSync({ kind: "file:write", path: cap.path });
      if (!check.allowed) {
        throw new Error(`Cannot attach @write:${cap.path} - you don't have it.`);
      }
    }
  }

  // Build sandbox with only validated capabilities
  return PermissionSet.create({
    id: "sandbox",
    workspacePath: source.workspacePath ?? undefined,
    capabilities: nonReadCaps
  });
}

/**
 * Normalize permission tags (dedupe, validate format).
 */
export function normalizePermissionTags(tags: unknown): string[] {
  if (!tags) {
    return [];
  }

  const entries = Array.isArray(tags) ? tags : [tags];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    // Validate by parsing (throws if invalid)
    try {
      const cap = parsePermissionTag(trimmed);
      const tag = formatPermissionTag(cap);

      if (!seen.has(tag)) {
        seen.add(tag);
        result.push(tag);
      }
    } catch {
      // Skip invalid tags
    }
  }

  return result;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
