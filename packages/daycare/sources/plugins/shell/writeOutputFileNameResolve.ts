/**
 * Resolves a unique output file name for /home/outputs by appending " (N)" on collisions.
 * Expects: baseName is a validated non-empty file name and extension is "md" or "json".
 */
export function writeOutputFileNameResolve(
    baseName: string,
    existingFileNames: Set<string>,
    extension = "md",
    maxSuffix = 99
): string {
    const normalizedBaseName = baseName.trim();
    const normalizedExtension = extension.trim().toLowerCase();
    if (!normalizedBaseName) {
        throw new Error("Output name must be non-empty.");
    }
    if (normalizedExtension !== "md" && normalizedExtension !== "json") {
        throw new Error(`Unsupported output extension: ${extension}`);
    }

    for (let suffix = 0; suffix <= maxSuffix; suffix += 1) {
        const candidate =
            suffix === 0
                ? `${normalizedBaseName}.${normalizedExtension}`
                : `${normalizedBaseName} (${suffix}).${normalizedExtension}`;
        if (!existingFileNames.has(candidate)) {
            return candidate;
        }
    }

    throw new Error(`Could not resolve unique output name for "${normalizedBaseName}" after ${maxSuffix} attempts.`);
}
