const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Checks if a release version is a valid semantic version string.
 * Expects: input is already trimmed and non-empty.
 */
export function releaseVersionIsValid(value: string): boolean {
  return SEMVER_PATTERN.test(value);
}
