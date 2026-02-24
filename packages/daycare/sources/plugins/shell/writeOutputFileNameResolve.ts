/**
 * Resolves a unique markdown file name for /home/outputs by appending " (N)" on collisions.
 * Expects: baseName is a validated non-empty file name without extension separators.
 */
export function writeOutputFileNameResolve(baseName: string, existingFileNames: Set<string>, maxSuffix = 99): string {
    const normalizedBaseName = baseName.trim();
    if (!normalizedBaseName) {
        throw new Error("Output name must be non-empty.");
    }

    for (let suffix = 0; suffix <= maxSuffix; suffix += 1) {
        const candidate = suffix === 0 ? `${normalizedBaseName}.md` : `${normalizedBaseName} (${suffix}).md`;
        if (!existingFileNames.has(candidate)) {
            return candidate;
        }
    }

    throw new Error(`Could not resolve unique output name for "${normalizedBaseName}" after ${maxSuffix} attempts.`);
}
