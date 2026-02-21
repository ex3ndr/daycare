import path from "node:path";
import { promises as fs } from "node:fs";

import type {
  Capability,
  FileReadCapability,
  FileWriteCapability,
  NetworkCapability,
  PermissionCheck,
  PermissionCheckResult
} from "./types.js";

/**
 * Check if a domain matches an allowed domain pattern.
 * Supports wildcard subdomains (e.g., *.example.com matches sub.example.com).
 */
export function domainMatches(domain: string, pattern: string): boolean {
  const normalizedDomain = domain.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();

  if (normalizedPattern === normalizedDomain) {
    return true;
  }

  // Wildcard subdomain matching
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1); // ".example.com"
    return normalizedDomain.endsWith(suffix) || normalizedDomain === normalizedPattern.slice(2);
  }

  return false;
}

/**
 * Check if a path is within a base path.
 * Handles path normalization and prevents directory traversal.
 */
export function isPathWithin(basePath: string, targetPath: string): boolean {
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(targetPath);
  const relative = path.relative(normalizedBase, normalizedTarget);

  // Path is within if relative path doesn't start with ".." and isn't absolute
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

/**
 * Check if a path is within a base path, resolving symlinks.
 * This is the secure version that prevents symlink attacks.
 */
export async function isPathWithinSecure(
  basePath: string,
  targetPath: string
): Promise<boolean> {
  try {
    // Resolve symlinks for both paths
    let realBase: string;
    try {
      realBase = await fs.realpath(basePath);
    } catch {
      realBase = path.resolve(basePath);
    }

    let realTarget: string;
    try {
      realTarget = await fs.realpath(targetPath);
    } catch {
      // Target doesn't exist yet - resolve the parent
      realTarget = await resolveNonExistentPath(targetPath);
    }

    return isPathWithin(realBase, realTarget);
  } catch {
    return false;
  }
}

/**
 * Resolve a path that may not exist by finding the nearest existing parent.
 */
async function resolveNonExistentPath(targetPath: string): Promise<string> {
  const missing: string[] = [path.basename(targetPath)];
  let parent = path.dirname(targetPath);

  while (true) {
    try {
      const realParent = await fs.realpath(parent);
      return path.join(realParent, ...missing);
    } catch {
      const next = path.dirname(parent);
      if (next === parent) {
        return path.resolve(targetPath);
      }
      missing.unshift(path.basename(parent));
      parent = next;
    }
  }
}

/**
 * Check network permission.
 */
export function checkNetwork(
  capability: NetworkCapability,
  domain?: string
): boolean {
  // No domain restriction means all domains allowed
  if (!capability.domains || capability.domains.length === 0) {
    return true;
  }

  // No specific domain requested means checking general network access
  if (!domain) {
    return true;
  }

  // Check if domain matches any allowed pattern
  return capability.domains.some((pattern) => domainMatches(domain, pattern));
}

/**
 * Check file read permission against capabilities.
 */
export function checkFileRead(
  capabilities: readonly (FileReadCapability | FileWriteCapability)[],
  targetPath: string
): PermissionCheckResult {
  const normalizedTarget = path.resolve(targetPath);

  for (const cap of capabilities) {
    if (!cap.recursive) {
      // Exact path match only
      if (path.resolve(cap.path) === normalizedTarget) {
        return {
          allowed: true,
          reason: `Allowed by ${cap.kind} capability for ${cap.path}`,
          capability: cap
        };
      }
    } else {
      // Recursive - check containment
      if (isPathWithin(cap.path, normalizedTarget)) {
        return {
          allowed: true,
          reason: `Allowed by ${cap.kind} capability for ${cap.path} (recursive)`,
          capability: cap
        };
      }
    }
  }

  return {
    allowed: false,
    reason: `No capability grants read access to ${targetPath}`
  };
}

/**
 * Check file read permission against capabilities (secure version with symlink resolution).
 */
export async function checkFileReadSecure(
  capabilities: readonly (FileReadCapability | FileWriteCapability)[],
  targetPath: string
): Promise<PermissionCheckResult> {
  const normalizedTarget = path.resolve(targetPath);

  for (const cap of capabilities) {
    if (!cap.recursive) {
      // Exact path match only
      if (path.resolve(cap.path) === normalizedTarget) {
        return {
          allowed: true,
          reason: `Allowed by ${cap.kind} capability for ${cap.path}`,
          capability: cap
        };
      }
    } else {
      // Recursive - check containment with symlink resolution
      if (await isPathWithinSecure(cap.path, normalizedTarget)) {
        return {
          allowed: true,
          reason: `Allowed by ${cap.kind} capability for ${cap.path} (recursive)`,
          capability: cap
        };
      }
    }
  }

  return {
    allowed: false,
    reason: `No capability grants read access to ${targetPath}`
  };
}

/**
 * Check file write permission against capabilities.
 */
export function checkFileWrite(
  capabilities: readonly FileWriteCapability[],
  targetPath: string
): PermissionCheckResult {
  const normalizedTarget = path.resolve(targetPath);

  for (const cap of capabilities) {
    if (!cap.recursive) {
      // Exact path match only
      if (path.resolve(cap.path) === normalizedTarget) {
        return {
          allowed: true,
          reason: `Allowed by file:write capability for ${cap.path}`,
          capability: cap
        };
      }
    } else {
      // Recursive - check containment
      if (isPathWithin(cap.path, normalizedTarget)) {
        return {
          allowed: true,
          reason: `Allowed by file:write capability for ${cap.path} (recursive)`,
          capability: cap
        };
      }
    }
  }

  return {
    allowed: false,
    reason: `No capability grants write access to ${targetPath}`
  };
}

/**
 * Check file write permission against capabilities (secure version with symlink resolution).
 */
export async function checkFileWriteSecure(
  capabilities: readonly FileWriteCapability[],
  targetPath: string
): Promise<PermissionCheckResult> {
  const normalizedTarget = path.resolve(targetPath);

  for (const cap of capabilities) {
    if (!cap.recursive) {
      // Exact path match only
      if (path.resolve(cap.path) === normalizedTarget) {
        return {
          allowed: true,
          reason: `Allowed by file:write capability for ${cap.path}`,
          capability: cap
        };
      }
    } else {
      // Recursive - check containment with symlink resolution
      if (await isPathWithinSecure(cap.path, normalizedTarget)) {
        return {
          allowed: true,
          reason: `Allowed by file:write capability for ${cap.path} (recursive)`,
          capability: cap
        };
      }
    }
  }

  return {
    allowed: false,
    reason: `No capability grants write access to ${targetPath}`
  };
}

/**
 * Perform a permission check against a set of capabilities.
 */
export async function checkPermission(
  capabilities: readonly Capability[],
  check: PermissionCheck
): Promise<PermissionCheckResult> {
  switch (check.kind) {
    case "network": {
      const networkCaps = capabilities.filter(
        (c): c is NetworkCapability => c.kind === "network"
      );
      if (networkCaps.length === 0) {
        return {
          allowed: false,
          reason: "No network capability"
        };
      }
      // Check if any network capability allows the domain
      for (const cap of networkCaps) {
        if (checkNetwork(cap, check.domain)) {
          return {
            allowed: true,
            reason: check.domain
              ? `Network access to ${check.domain} allowed`
              : "Network access allowed",
            capability: cap
          };
        }
      }
      return {
        allowed: false,
        reason: check.domain
          ? `No capability allows network access to ${check.domain}`
          : "Network access not allowed"
      };
    }

    case "events": {
      const eventsCap = capabilities.find((c) => c.kind === "events");
      if (eventsCap) {
        return {
          allowed: true,
          reason: "Events access allowed",
          capability: eventsCap
        };
      }
      return {
        allowed: false,
        reason: "No events capability"
      };
    }

    case "file:read": {
      // Both read and write capabilities grant read access
      const readCaps = capabilities.filter(
        (c): c is FileReadCapability | FileWriteCapability =>
          c.kind === "file:read" || c.kind === "file:write"
      );
      return checkFileReadSecure(readCaps, check.path);
    }

    case "file:write": {
      const writeCaps = capabilities.filter(
        (c): c is FileWriteCapability => c.kind === "file:write"
      );
      return checkFileWriteSecure(writeCaps, check.path);
    }
  }
}

/**
 * Synchronous permission check (doesn't resolve symlinks).
 * Use for performance-critical paths where symlink attacks are not a concern.
 */
export function checkPermissionSync(
  capabilities: readonly Capability[],
  check: PermissionCheck
): PermissionCheckResult {
  switch (check.kind) {
    case "network": {
      const networkCaps = capabilities.filter(
        (c): c is NetworkCapability => c.kind === "network"
      );
      if (networkCaps.length === 0) {
        return {
          allowed: false,
          reason: "No network capability"
        };
      }
      for (const cap of networkCaps) {
        if (checkNetwork(cap, check.domain)) {
          return {
            allowed: true,
            reason: check.domain
              ? `Network access to ${check.domain} allowed`
              : "Network access allowed",
            capability: cap
          };
        }
      }
      return {
        allowed: false,
        reason: check.domain
          ? `No capability allows network access to ${check.domain}`
          : "Network access not allowed"
      };
    }

    case "events": {
      const eventsCap = capabilities.find((c) => c.kind === "events");
      if (eventsCap) {
        return {
          allowed: true,
          reason: "Events access allowed",
          capability: eventsCap
        };
      }
      return {
        allowed: false,
        reason: "No events capability"
      };
    }

    case "file:read": {
      const readCaps = capabilities.filter(
        (c): c is FileReadCapability | FileWriteCapability =>
          c.kind === "file:read" || c.kind === "file:write"
      );
      return checkFileRead(readCaps, check.path);
    }

    case "file:write": {
      const writeCaps = capabilities.filter(
        (c): c is FileWriteCapability => c.kind === "file:write"
      );
      return checkFileWrite(writeCaps, check.path);
    }
  }
}
