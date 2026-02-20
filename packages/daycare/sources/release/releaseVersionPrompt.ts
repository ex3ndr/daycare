import { promptInput, promptSelect } from "../commands/prompts.js";

import { releaseVersionIncrement } from "./releaseVersionIncrement.js";

const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

type ReleaseVersionMode = "major" | "minor" | "patch" | "custom";

/**
 * Prompts for a release version strategy and resolves the next semantic version.
 * Expects: currentVersion is a valid semantic version.
 */
export async function releaseVersionPrompt(currentVersion: string): Promise<string> {
    const nextVersions = {
        patch: releaseVersionIncrement(currentVersion, "patch"),
        minor: releaseVersionIncrement(currentVersion, "minor"),
        major: releaseVersionIncrement(currentVersion, "major")
    };

    const mode = await promptSelect<ReleaseVersionMode>({
        message: `Current version is ${currentVersion}. Select release increment:`,
        choices: [
            { value: "patch", name: `patch -> ${nextVersions.patch}` },
            { value: "minor", name: `minor -> ${nextVersions.minor}` },
            { value: "major", name: `major -> ${nextVersions.major}` },
            { value: "custom", name: "custom (enter version)" }
        ]
    });

    if (!mode) {
        throw new Error("Release cancelled.");
    }

    if (mode !== "custom") {
        return nextVersions[mode];
    }

    const customVersion = await promptInput({
        message: "Enter custom semantic version",
        default: nextVersions.patch,
        placeholder: "x.y.z"
    });

    if (!customVersion) {
        throw new Error("Release cancelled.");
    }

    const normalizedVersion = customVersion.trim();
    if (!SEMVER_PATTERN.test(normalizedVersion)) {
        throw new Error("Version must be a valid semantic version.");
    }
    if (normalizedVersion === currentVersion) {
        throw new Error("New version must differ from current version.");
    }

    return normalizedVersion;
}
