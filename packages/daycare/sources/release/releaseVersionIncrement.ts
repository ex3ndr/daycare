const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

type ReleaseVersionIncrementKind = "major" | "minor" | "patch";

/**
 * Increments a semantic version using major, minor, or patch semantics.
 * Expects: value is a valid semantic version.
 */
export function releaseVersionIncrement(value: string, kind: ReleaseVersionIncrementKind): string {
    const match = SEMVER_PATTERN.exec(value.trim());
    if (!match) {
        throw new Error(`Invalid semantic version: ${value}`);
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);

    switch (kind) {
        case "major":
            return `${major + 1}.0.0`;
        case "minor":
            return `${major}.${minor + 1}.0`;
        case "patch":
            return `${major}.${minor}.${patch + 1}`;
    }
}
