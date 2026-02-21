import path from "node:path";

import type {
  Capability,
  FileReadCapability,
  FileWriteCapability,
  NetworkCapability,
  PermissionSetConfig
} from "./types.js";
import { PermissionSet } from "./permissionSet.js";

/**
 * Fluent builder for constructing PermissionSet instances.
 * 
 * @example
 * ```ts
 * const permissions = PermissionSetBuilder.create("my-agent")
 *   .workspace("/home/user/.daycare/workspace")
 *   .network()
 *   .events()
 *   .write("/home/user/documents")
 *   .read("/home/user/downloads")
 *   .build();
 * ```
 */
export class PermissionSetBuilder {
  private id: string;
  private label: string | undefined;
  private workspacePath: string | undefined;
  private capabilities: Capability[] = [];
  private parent: PermissionSetConfig | undefined;

  private constructor(id: string) {
    this.id = id;
  }

  /**
   * Create a new builder with the given ID.
   */
  static create(id: string): PermissionSetBuilder {
    return new PermissionSetBuilder(id);
  }

  /**
   * Set a human-readable label.
   */
  withLabel(label: string): this {
    this.label = label;
    return this;
  }

  /**
   * Set the workspace directory (grants recursive read/write).
   */
  workspace(workspacePath: string): this {
    this.workspacePath = path.resolve(workspacePath);
    return this;
  }

  /**
   * Alias for workspace().
   */
  withWorkspace(workspacePath: string): this {
    return this.workspace(workspacePath);
  }

  /**
   * Add network access capability.
   * @param domains Optional domain restrictions. If empty, all domains are allowed.
   */
  network(domains?: readonly string[]): this {
    const cap: NetworkCapability = { kind: "network", domains };
    this.capabilities.push(cap);
    return this;
  }

  /**
   * Alias for network().
   */
  allowNetwork(domains?: readonly string[]): this {
    return this.network(domains);
  }

  /**
   * Add events socket access capability.
   */
  events(): this {
    this.capabilities.push({ kind: "events" });
    return this;
  }

  /**
   * Alias for events().
   */
  allowEvents(): this {
    return this.events();
  }

  /**
   * Add file read capability.
   * @param filePath Path to grant read access to.
   * @param recursive Whether to include subdirectories (default: true).
   */
  read(filePath: string, recursive: boolean = true): this {
    const cap: FileReadCapability = {
      kind: "file:read",
      path: path.resolve(filePath),
      recursive
    };
    this.capabilities.push(cap);
    return this;
  }

  /**
   * Alias for read().
   */
  allowRead(filePath: string, recursive: boolean = true): this {
    return this.read(filePath, recursive);
  }

  /**
   * Add file write capability.
   * @param filePath Path to grant write access to.
   * @param recursive Whether to include subdirectories (default: true).
   */
  write(filePath: string, recursive: boolean = true): this {
    const cap: FileWriteCapability = {
      kind: "file:write",
      path: path.resolve(filePath),
      recursive
    };
    this.capabilities.push(cap);
    return this;
  }

  /**
   * Alias for write().
   */
  allowWrite(filePath: string, recursive: boolean = true): this {
    return this.write(filePath, recursive);
  }

  /**
   * Add multiple read paths at once.
   */
  readPaths(paths: readonly string[], recursive: boolean = true): this {
    for (const p of paths) {
      this.read(p, recursive);
    }
    return this;
  }

  /**
   * Add multiple write paths at once.
   */
  writePaths(paths: readonly string[], recursive: boolean = true): this {
    for (const p of paths) {
      this.write(p, recursive);
    }
    return this;
  }

  /**
   * Inherit capabilities from a parent configuration.
   */
  inherit(parent: PermissionSetConfig): this {
    this.parent = parent;
    return this;
  }

  /**
   * Inherit capabilities from an existing PermissionSet.
   */
  inheritFrom(parent: PermissionSet): this {
    this.parent = parent.serialize();
    return this;
  }

  /**
   * Add a raw capability.
   */
  capability(cap: Capability): this {
    this.capabilities.push(cap);
    return this;
  }

  /**
   * Add multiple raw capabilities.
   */
  withCapabilities(caps: readonly Capability[]): this {
    this.capabilities.push(...caps);
    return this;
  }

  /**
   * Build the PermissionSet.
   */
  build(): PermissionSet {
    return PermissionSet.create({
      id: this.id,
      label: this.label,
      workspacePath: this.workspacePath,
      capabilities: this.capabilities,
      parent: this.parent
    });
  }
}

/**
 * Builder for deriving a restricted PermissionSet from an existing one.
 * 
 * @example
 * ```ts
 * const sandboxed = DerivationBuilder.from(permissions)
 *   .revokeNetwork()
 *   .restrictWriteTo(["/tmp"])
 *   .build();
 * ```
 */
export class DerivationBuilder {
  private source: PermissionSet;
  private keepNetwork: boolean = true;
  private keepEvents: boolean = true;
  private restrictWriteToList: string[] | undefined;
  private additionalCapabilities: Capability[] = [];
  private newId: string | undefined;
  private newLabel: string | undefined;

  private constructor(source: PermissionSet) {
    this.source = source;
  }

  /**
   * Create a derivation builder from an existing PermissionSet.
   */
  static from(source: PermissionSet): DerivationBuilder {
    return new DerivationBuilder(source);
  }

  /**
   * Set a new ID for the derived set.
   */
  withId(id: string): this {
    this.newId = id;
    return this;
  }

  /**
   * Set a new label for the derived set.
   */
  withLabel(label: string): this {
    this.newLabel = label;
    return this;
  }

  /**
   * Revoke network access.
   */
  revokeNetwork(): this {
    this.keepNetwork = false;
    return this;
  }

  /**
   * Revoke events access.
   */
  revokeEvents(): this {
    this.keepEvents = false;
    return this;
  }

  /**
   * Restrict write access to only the specified paths.
   * Paths must be subsets of the original write permissions.
   */
  restrictWriteTo(paths: readonly string[]): this {
    this.restrictWriteToList = paths.map((p) => path.resolve(p));
    return this;
  }

  /**
   * Add additional capabilities to the derived set.
   */
  addCapability(cap: Capability): this {
    this.additionalCapabilities.push(cap);
    return this;
  }

  /**
   * Add additional read access.
   */
  addRead(filePath: string, recursive: boolean = true): this {
    this.additionalCapabilities.push({
      kind: "file:read",
      path: path.resolve(filePath),
      recursive
    });
    return this;
  }

  /**
   * Add additional write access.
   */
  addWrite(filePath: string, recursive: boolean = true): this {
    this.additionalCapabilities.push({
      kind: "file:write",
      path: path.resolve(filePath),
      recursive
    });
    return this;
  }

  /**
   * Build the derived PermissionSet.
   */
  build(): PermissionSet {
    let result = this.source.sandbox({
      keepNetwork: this.keepNetwork,
      keepEvents: this.keepEvents,
      restrictWriteTo: this.restrictWriteToList
    });

    if (this.additionalCapabilities.length > 0) {
      result = result.extend(this.additionalCapabilities);
    }

    // If ID or label changed, we need to recreate
    if (this.newId || this.newLabel) {
      return PermissionSet.create({
        id: this.newId ?? result.id,
        label: this.newLabel ?? result.label,
        workspacePath: result.workspacePath ?? undefined,
        capabilities: result.capabilities
      });
    }

    return result;
  }
}

/**
 * Convenience function for creating permissions with common patterns.
 */
export const Permissions = {
  /**
   * Create a minimal permission set with just workspace access.
   */
  workspace(id: string, workspacePath: string): PermissionSet {
    return PermissionSetBuilder.create(id)
      .workspace(workspacePath)
      .build();
  },

  /**
   * Create a permission set with workspace and network access.
   */
  workspaceWithNetwork(
    id: string,
    workspacePath: string,
    domains?: readonly string[]
  ): PermissionSet {
    return PermissionSetBuilder.create(id)
      .workspace(workspacePath)
      .network(domains)
      .build();
  },

  /**
   * Create a permission set with full access (workspace, network, events).
   */
  full(id: string, workspacePath: string): PermissionSet {
    return PermissionSetBuilder.create(id)
      .workspace(workspacePath)
      .network()
      .events()
      .build();
  },

  /**
   * Create an empty permission set.
   */
  empty(id: string = "empty"): PermissionSet {
    return PermissionSet.empty(id);
  },

  /**
   * Start a new builder.
   */
  builder(id: string): PermissionSetBuilder {
    return PermissionSetBuilder.create(id);
  },

  /**
   * Derive from an existing permission set.
   */
  derive(source: PermissionSet): DerivationBuilder {
    return DerivationBuilder.from(source);
  }
};
