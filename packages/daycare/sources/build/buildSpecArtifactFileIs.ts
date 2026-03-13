const specArtifactPatterns = [
    /\.spec\.js$/,
    /\.spec\.js\.map$/,
    /\.spec\.d\.ts$/,
    /\.spec\.d\.ts\.map$/,
    /\.spec\.ts$/,
    /\.spec\.tsx$/,
    /\.spec\.mts$/,
    /\.spec\.cts$/
];

/**
 * Returns true when a dist file is a generated spec artifact and should be removed.
 * Expects: relativePath is a path inside dist.
 */
export function buildSpecArtifactFileIs(relativePath: string): boolean {
    return specArtifactPatterns.some((pattern) => pattern.test(relativePath));
}
