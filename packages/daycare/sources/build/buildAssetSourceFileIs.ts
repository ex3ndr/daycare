import path from "node:path";

/**
 * Returns true when a source file should be copied into dist as a raw asset.
 * Expects: sourcePath is a file path under sources/.
 */
export function buildAssetSourceFileIs(sourcePath: string): boolean {
    const fileName = path.basename(sourcePath);
    return !buildTypeScriptFileIs(fileName);
}

function buildTypeScriptFileIs(fileName: string): boolean {
    return (
        fileName.endsWith(".ts") || fileName.endsWith(".tsx") || fileName.endsWith(".mts") || fileName.endsWith(".cts")
    );
}
