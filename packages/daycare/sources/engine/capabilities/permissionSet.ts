import path from "node:path";

import type {
  Capability,
  CapabilityAudit,
  FileReadCapability,
  FileWriteCapability,
  NetworkCapability,
  PermissionAudit,
  PermissionCheck,
  PermissionCheckResult,
  PermissionSetConfig,
  SerializedPermissionSet
} from "./types.js";
import { checkPermission, checkPermissionSync } from "./permissionCheck.js";

/**
 * PermissionSet represents an immutable collection of capabilities.
 * 
 * Key features:
 * - Immutable: all operations return new instances
 * - Type-safe: capabilities are discriminated unions
 * - Hierarchical: write capabilities imply read capabilities
 * - Auditable: provides clear visibility into effective permissions
 */
export class PermissionSet {
  readonly id: string;
  readonly label: string;
  readonly workspacePath: string | null;
  private readonly _capabilities: readonly Capability[];
  private readonly _capabilityAudits: readonly CapabilityAudit[];

  private constructor(
    id: string,
    label: string,
    workspacePath: string | null,
    capabilities: readonly Capability[],
    audits: readonly CapabilityAudit[]
  ) {
    this.id = id;
    this.label = label;
    this.workspacePath = workspacePath;
    this._capabilities = Object.freeze([...capabilities]);
    this._capabilityAudits = Object.freeze([...audits]);
  }

  /**
   * Create a new PermissionSet from configuration.
   */
  static create(config: PermissionSetConfig): PermissionSet {
    const id = config.id;
    const label = config.label ?? id;
    const workspacePath = config.workspacePath
      ? path.resolve(config.workspacePath)
      : null;

    const capabilities: Capability[] = [];
    const audits: CapabilityAudit[] = [];

    // Add workspace capabilities if configured
    if (workspacePath) {
      const workspaceWrite: FileWriteCapability = {
        kind: "file:write",
        path: workspacePath,
        recursive: true
      };
      capabilities.push(workspaceWrite);
      audits.push({
        capability: workspaceWrite,
        source: "workspace",
        description: `Write access to workspace: ${workspacePath}`
      });
    }

    // Add explicit capabilities
    if (config.capabilities) {
      for (const cap of config.capabilities) {
        capabilities.push(cap);
        audits.push({
          capability: cap,
          source: "explicit",
          description: describeCapability(cap)
        });
      }
    }

    // Merge parent capabilities if present
    if (config.parent) {
      const parent = PermissionSet.create(config.parent);
      for (const audit of parent._capabilityAudits) {
        // Don't duplicate capabilities
        if (!hasEquivalentCapability(capabilities, audit.capability)) {
          capabilities.push(audit.capability);
          audits.push({
            ...audit,
            source: "inherited"
          });
        }
      }
    }

    return new PermissionSet(id, label, workspacePath, capabilities, audits);
  }

  /**
   * Create an empty PermissionSet.
   */
  static empty(id: string = "empty"): PermissionSet {
    return new PermissionSet(id, "Empty", null, [], []);
  }

  /**
   * Deserialize from stored format.
   */
  static deserialize(data: SerializedPermissionSet): PermissionSet {
    return PermissionSet.create({
      id: data.id,
      label: data.label,
      workspacePath: data.workspacePath ?? undefined,
      capabilities: data.capabilities
    });
  }

  /**
   * Get all capabilities.
   */
  get capabilities(): readonly Capability[] {
    return this._capabilities;
  }

  /**
   * Get capabilities with audit information.
   */
  get capabilityAudits(): readonly CapabilityAudit[] {
    return this._capabilityAudits;
  }

  /**
   * Check if network access is allowed.
   */
  get hasNetwork(): boolean {
    return this._capabilities.some((c) => c.kind === "network");
  }

  /**
   * Check if events access is allowed.
   */
  get hasEvents(): boolean {
    return this._capabilities.some((c) => c.kind === "events");
  }

  /**
   * Get all network capabilities.
   */
  get networkCapabilities(): readonly NetworkCapability[] {
    return this._capabilities.filter(
      (c): c is NetworkCapability => c.kind === "network"
    );
  }

  /**
   * Get all file read capabilities (including write which implies read).
   */
  get readCapabilities(): readonly (FileReadCapability | FileWriteCapability)[] {
    return this._capabilities.filter(
      (c): c is FileReadCapability | FileWriteCapability =>
        c.kind === "file:read" || c.kind === "file:write"
    );
  }

  /**
   * Get all file write capabilities.
   */
  get writeCapabilities(): readonly FileWriteCapability[] {
    return this._capabilities.filter(
      (c): c is FileWriteCapability => c.kind === "file:write"
    );
  }

  /**
   * Get write directory paths (for legacy compatibility).
   */
  get writePaths(): readonly string[] {
    return this.writeCapabilities.map((c) => c.path);
  }

  /**
   * Get explicit read directory paths (excludes implicit read from write).
   */
  get readPaths(): readonly string[] {
    return this._capabilities
      .filter((c): c is FileReadCapability => c.kind === "file:read")
      .map((c) => c.path);
  }

  /**
   * Check permission asynchronously (secure, resolves symlinks).
   */
  async check(check: PermissionCheck): Promise<PermissionCheckResult> {
    return checkPermission(this._capabilities, check);
  }

  /**
   * Check permission synchronously (faster, doesn't resolve symlinks).
   */
  checkSync(check: PermissionCheck): PermissionCheckResult {
    return checkPermissionSync(this._capabilities, check);
  }

  /**
   * Quick check if network access is allowed for a domain.
   */
  allowsNetwork(domain?: string): boolean {
    return this.checkSync({ kind: "network", domain }).allowed;
  }

  /**
   * Quick check if events access is allowed.
   */
  allowsEvents(): boolean {
    return this.checkSync({ kind: "events" }).allowed;
  }

  /**
   * Quick check if read access is allowed for a path (sync, no symlink resolution).
   */
  allowsReadSync(filePath: string): boolean {
    return this.checkSync({ kind: "file:read", path: filePath }).allowed;
  }

  /**
   * Quick check if write access is allowed for a path (sync, no symlink resolution).
   */
  allowsWriteSync(filePath: string): boolean {
    return this.checkSync({ kind: "file:write", path: filePath }).allowed;
  }

  /**
   * Create a new PermissionSet with additional capabilities.
   */
  extend(capabilities: readonly Capability[]): PermissionSet {
    const newAudits: CapabilityAudit[] = capabilities.map((cap) => ({
      capability: cap,
      source: "explicit" as const,
      description: describeCapability(cap)
    }));

    return new PermissionSet(
      this.id,
      this.label,
      this.workspacePath,
      [...this._capabilities, ...capabilities],
      [...this._capabilityAudits, ...newAudits]
    );
  }

  /**
   * Create a new PermissionSet with network access.
   */
  withNetwork(domains?: readonly string[]): PermissionSet {
    return this.extend([{ kind: "network", domains }]);
  }

  /**
   * Create a new PermissionSet with events access.
   */
  withEvents(): PermissionSet {
    return this.extend([{ kind: "events" }]);
  }

  /**
   * Create a new PermissionSet with additional read access.
   */
  withRead(filePath: string, recursive: boolean = true): PermissionSet {
    return this.extend([
      { kind: "file:read", path: path.resolve(filePath), recursive }
    ]);
  }

  /**
   * Create a new PermissionSet with additional write access.
   */
  withWrite(filePath: string, recursive: boolean = true): PermissionSet {
    return this.extend([
      { kind: "file:write", path: path.resolve(filePath), recursive }
    ]);
  }

  /**
   * Create a restricted PermissionSet for sandboxed execution.
   * By default, strips network and events access.
   */
  sandbox(options: {
    keepNetwork?: boolean;
    keepEvents?: boolean;
    restrictWriteTo?: readonly string[];
  } = {}): PermissionSet {
    const filtered = this._capabilities.filter((cap) => {
      if (cap.kind === "network" && !options.keepNetwork) {
        return false;
      }
      if (cap.kind === "events" && !options.keepEvents) {
        return false;
      }
      if (cap.kind === "file:write" && options.restrictWriteTo) {
        // Only keep write capabilities that are in the restriction list
        const normalizedRestrictions = options.restrictWriteTo.map((p) =>
          path.resolve(p)
        );
        const normalizedCapPath = path.resolve(cap.path);
        return normalizedRestrictions.some(
          (r) =>
            normalizedCapPath === r ||
            normalizedCapPath.startsWith(r + path.sep)
        );
      }
      return true;
    });

    const filteredAudits = this._capabilityAudits.filter((audit) =>
      filtered.some((cap) => capabilitiesEqual(cap, audit.capability))
    );

    return new PermissionSet(
      `${this.id}:sandboxed`,
      `${this.label} (sandboxed)`,
      this.workspacePath,
      filtered,
      filteredAudits
    );
  }

  /**
   * Generate a comprehensive audit of this permission set.
   */
  audit(): PermissionAudit {
    const networkCaps = this.networkCapabilities;
    const readCaps = this.readCapabilities;
    const writeCaps = this.writeCapabilities;

    const summary: string[] = [];

    // Network summary
    if (networkCaps.length > 0) {
      const allDomains = networkCaps.flatMap((c) => c.domains ?? []);
      if (allDomains.length === 0) {
        summary.push("Network access (all domains)");
      } else {
        summary.push(`Network access (${allDomains.join(", ")})`);
      }
    }

    // Events summary
    if (this.hasEvents) {
      summary.push("Events socket access");
    }

    // Write summary
    if (writeCaps.length > 0) {
      const paths = writeCaps.map((c) => c.path).join(", ");
      summary.push(`Write access: ${paths}`);
    }

    // Read summary (explicit reads only, not implied by write)
    const explicitReads = readCaps.filter((c) => c.kind === "file:read");
    if (explicitReads.length > 0) {
      const paths = explicitReads.map((c) => c.path).join(", ");
      summary.push(`Read access: ${paths}`);
    }

    return {
      id: this.id,
      label: this.label,
      workspacePath: this.workspacePath,
      network: {
        allowed: networkCaps.length > 0,
        domains:
          networkCaps.length === 0
            ? []
            : networkCaps.some((c) => !c.domains || c.domains.length === 0)
              ? "all"
              : networkCaps.flatMap((c) => c.domains ?? [])
      },
      events: {
        allowed: this.hasEvents
      },
      read: readCaps.map((cap) => {
        const audit = this._capabilityAudits.find((a) =>
          capabilitiesEqual(a.capability, cap)
        );
        return {
          path: cap.path,
          recursive: cap.recursive,
          source: audit?.source ?? "explicit"
        };
      }),
      write: writeCaps.map((cap) => {
        const audit = this._capabilityAudits.find((a) =>
          capabilitiesEqual(a.capability, cap)
        );
        return {
          path: cap.path,
          recursive: cap.recursive,
          source: audit?.source ?? "explicit"
        };
      }),
      summary
    };
  }

  /**
   * Serialize for storage or transmission.
   */
  serialize(): SerializedPermissionSet {
    return {
      id: this.id,
      label: this.label,
      workspacePath: this.workspacePath,
      capabilities: this._capabilities
    };
  }

  /**
   * Human-readable description of permissions.
   */
  describe(): string {
    const audit = this.audit();
    return audit.summary.join("\n");
  }
}

/**
 * Describe a capability in human-readable terms.
 */
function describeCapability(cap: Capability): string {
  switch (cap.kind) {
    case "network":
      if (!cap.domains || cap.domains.length === 0) {
        return "Network access (all domains)";
      }
      return `Network access (${cap.domains.join(", ")})`;
    case "events":
      return "Events socket access";
    case "file:read":
      return `Read access to ${cap.path}${cap.recursive ? " (recursive)" : ""}`;
    case "file:write":
      return `Write access to ${cap.path}${cap.recursive ? " (recursive)" : ""}`;
  }
}

/**
 * Check if two capabilities are equivalent.
 */
function capabilitiesEqual(a: Capability, b: Capability): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  switch (a.kind) {
    case "network": {
      const bNet = b as NetworkCapability;
      const aDomains = a.domains ?? [];
      const bDomains = bNet.domains ?? [];
      return (
        aDomains.length === bDomains.length &&
        aDomains.every((d, i) => d === bDomains[i])
      );
    }
    case "events":
      return true;
    case "file:read":
    case "file:write": {
      const bFile = b as FileReadCapability | FileWriteCapability;
      return a.path === bFile.path && a.recursive === bFile.recursive;
    }
  }
}

/**
 * Check if capabilities array already has an equivalent capability.
 */
function hasEquivalentCapability(
  capabilities: readonly Capability[],
  cap: Capability
): boolean {
  return capabilities.some((c) => capabilitiesEqual(c, cap));
}
