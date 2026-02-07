import os from "node:os";
import path from "node:path";

import type { SessionPermissions } from "@/types";

const COMMON_HOME_RELATIVE_DENY_PATHS = [
  ".ssh",
  ".gnupg",
  ".aws",
  ".kube",
  ".docker",
  ".config/gcloud",
  ".config/gh",
  ".config/op",
  ".config/1Password",
  ".local/share/keyrings",
  ".npmrc",
  ".pypirc",
  ".netrc",
  ".git-credentials"
];

const COMMON_SYSTEM_DENY_PATHS = [
  "/etc/ssh",
  "/etc/sudoers",
  "/etc/sudoers.d",
  "/etc/shadow",
  "/etc/gshadow",
  "/etc/ssl/private"
];

const DARWIN_HOME_RELATIVE_DENY_PATHS = [
  "Library/Keychains",
  "Library/Application Support/iCloud",
  "Library/Application Support/com.apple.TCC",
  "Library/Group Containers"
];

const DARWIN_SYSTEM_DENY_PATHS = [
  "/private/etc/ssh",
  "/private/etc/sudoers",
  "/private/etc/sudoers.d",
  "/private/etc/master.passwd"
];

const LINUX_SYSTEM_DENY_PATHS = ["/root/.ssh"];

type SandboxFilesystemPolicyBuildInput = {
  permissions: SessionPermissions;
  homeDir?: string;
  platform?: NodeJS.Platform;
};

type SandboxFilesystemPolicy = {
  denyRead: string[];
  allowWrite: string[];
  denyWrite: string[];
};

/**
 * Builds sandbox filesystem policy with a default sensitive-path deny list.
 * Expects: permissions paths are already absolute and normalized.
 */
export function sandboxFilesystemPolicyBuild(
  input: SandboxFilesystemPolicyBuildInput
): SandboxFilesystemPolicy {
  const platform = input.platform ?? process.platform;
  const homeDir = path.resolve(input.homeDir ?? os.homedir());

  const allowWrite = dedupeResolvedPaths([
    ...input.permissions.writeDirs
  ]);

  const homeDeny = COMMON_HOME_RELATIVE_DENY_PATHS.map((entry) =>
    path.resolve(homeDir, entry)
  );
  const platformHomeDeny =
    platform === "darwin"
      ? DARWIN_HOME_RELATIVE_DENY_PATHS.map((entry) => path.resolve(homeDir, entry))
      : [];
  const platformSystemDeny = platform === "darwin"
    ? DARWIN_SYSTEM_DENY_PATHS
    : platform === "linux"
      ? LINUX_SYSTEM_DENY_PATHS
      : [];

  const denyRead = dedupeResolvedPaths([
    ...homeDeny,
    ...platformHomeDeny,
    ...COMMON_SYSTEM_DENY_PATHS,
    ...platformSystemDeny
  ]);

  return {
    denyRead,
    allowWrite,
    // Keep read/write denials aligned to prevent both data exfiltration and tampering.
    denyWrite: [...denyRead]
  };
}

function dedupeResolvedPaths(values: string[]): string[] {
  const resolved = values
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => path.resolve(entry));
  return Array.from(new Set(resolved));
}
