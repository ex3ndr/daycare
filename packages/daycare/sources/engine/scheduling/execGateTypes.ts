import type { SandboxPackageManager } from "../../sandbox/sandboxPackageManagers.js";

/**
 * Exec gate configuration for scheduled tasks.
 */
export type ExecGateDefinition = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  redefineHome?: boolean;
  permissions?: string[];
  packageManagers?: SandboxPackageManager[];
  allowedDomains?: string[];
};
