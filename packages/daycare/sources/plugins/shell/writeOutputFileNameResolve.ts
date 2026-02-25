/**
 * Resolves a unique output file name for ~/outputs with a YYYYMMDDHHMMSS date prefix.
 * Format: YYYYMMDDHHMMSS-<name>.ext, collision: YYYYMMDDHHMMSS-<name>-<N>.ext.
 * Expects: baseName is a validated non-empty file name and extension is "md" or "json".
 */
export function writeOutputFileNameResolve(
    baseName: string,
    existingFileNames: Set<string>,
    extension = "md",
    maxSuffix = 99,
    now = Date.now()
): string {
    const normalizedBaseName = baseName.trim();
    const normalizedExtension = extension.trim().toLowerCase();
    if (!normalizedBaseName) {
        throw new Error("Output name must be non-empty.");
    }
    if (normalizedExtension !== "md" && normalizedExtension !== "json") {
        throw new Error(`Unsupported output extension: ${extension}`);
    }

    const prefix = outputTimestampPrefix(now);
    const prefixedName = `${prefix}-${normalizedBaseName}`;

    for (let suffix = 0; suffix <= maxSuffix; suffix += 1) {
        const candidate =
            suffix === 0
                ? `${prefixedName}.${normalizedExtension}`
                : `${prefixedName}-${suffix}.${normalizedExtension}`;
        if (!existingFileNames.has(candidate)) {
            return candidate;
        }
    }

    throw new Error(`Could not resolve unique output name for "${normalizedBaseName}" after ${maxSuffix} attempts.`);
}

/** Formats a unix timestamp (ms) as YYYYMMDDHHMMSS for file name prefixing. */
function outputTimestampPrefix(now: number): string {
    const d = new Date(now);
    const yyyy = d.getFullYear();
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const HH = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}
