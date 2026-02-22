import os from "node:os";
import path from "node:path";

type SandboxSensitiveDenyPathsBuildInput = {
    homeDir?: string;
    platform?: NodeJS.Platform;
};

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

/**
 * Builds the shared sensitive filesystem deny-list used by sandbox checks.
 * Expects: homeDir, when provided, is an absolute or resolvable path.
 */
export function sandboxSensitiveDenyPathsBuild(input: SandboxSensitiveDenyPathsBuildInput = {}): string[] {
    const platform = input.platform ?? process.platform;
    const homeDir = path.resolve(input.homeDir ?? os.homedir());

    const platformHomeDeny =
        platform === "darwin" ? DARWIN_HOME_RELATIVE_DENY_PATHS.map((entry) => path.resolve(homeDir, entry)) : [];
    const platformSystemDeny =
        platform === "darwin" ? DARWIN_SYSTEM_DENY_PATHS : platform === "linux" ? LINUX_SYSTEM_DENY_PATHS : [];

    return dedupeResolvedPaths([
        ...COMMON_HOME_RELATIVE_DENY_PATHS.map((entry) => path.resolve(homeDir, entry)),
        ...platformHomeDeny,
        ...COMMON_SYSTEM_DENY_PATHS,
        ...platformSystemDeny
    ]);
}

function dedupeResolvedPaths(values: string[]): string[] {
    const resolved = values
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => path.resolve(entry));
    return Array.from(new Set(resolved));
}
