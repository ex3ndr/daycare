const compiledSuffixes = [".js", ".js.map", ".d.ts", ".d.ts.map"];

/**
 * Returns true when a dist file is produced by TypeScript compilation and must be preserved.
 * Expects: relativePath is a path inside dist.
 */
export function buildCompiledFileIs(relativePath: string): boolean {
    return compiledSuffixes.some((suffix) => relativePath.endsWith(suffix));
}
