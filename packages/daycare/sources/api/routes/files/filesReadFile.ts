import { promises as fs } from "node:fs";
import path from "node:path";
import { pathResolveSecure } from "../../../sandbox/pathResolveSecure.js";

export type FilesReadFileInput = {
    homeDir: string;
    requestedPath: string;
};

export type FilesReadFileResult =
    | {
          ok: true;
          path: string;
          name: string;
          size: number;
          modifiedAt: number;
          mimeType: string;
          encoding: "utf8" | "base64";
          content: string;
      }
    | { ok: false; error: string; statusCode: number };

const MAX_PREVIEW_SIZE = 1_000_000;

/**
 * Reads a file for preview. Text files return utf8; images return base64.
 * Enforces a 1MB size limit. Uses pathResolveSecure to prevent symlink escape.
 *
 * Expects: homeDir is absolute; requestedPath is user-supplied.
 */
export async function filesReadFile(input: FilesReadFileInput): Promise<FilesReadFileResult> {
    const requested = input.requestedPath.trim();
    if (!requested) {
        return { ok: false, error: "path is required.", statusCode: 400 };
    }

    const absolutePath = path.resolve(input.homeDir, requested);

    // Verify the resolved path is within the home directory (follows symlinks)
    let resolved: { realPath: string };
    try {
        resolved = await pathResolveSecure([input.homeDir], absolutePath);
    } catch {
        return { ok: false, error: "Invalid path.", statusCode: 400 };
    }

    // Use lstat on the resolved real path to reject symlinks at the leaf
    let lstat: import("node:fs").Stats;
    try {
        lstat = await fs.lstat(resolved.realPath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { ok: false, error: "File not found.", statusCode: 404 };
        }
        throw error;
    }

    if (lstat.isSymbolicLink()) {
        return { ok: false, error: "Symlinks are not allowed.", statusCode: 403 };
    }
    if (!lstat.isFile()) {
        return { ok: false, error: "Path is not a file.", statusCode: 400 };
    }

    if (lstat.size > MAX_PREVIEW_SIZE) {
        return { ok: false, error: "File too large for preview.", statusCode: 413 };
    }

    const mimeType = filesMimeTypeResolve(resolved.realPath);
    const isText = mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml");
    const content = await fs.readFile(resolved.realPath);
    const encoding = isText ? ("utf8" as const) : ("base64" as const);

    return {
        ok: true,
        path: requested,
        name: path.basename(resolved.realPath),
        size: lstat.size,
        modifiedAt: Math.floor(lstat.mtimeMs),
        mimeType,
        encoding,
        content: isText ? content.toString("utf8") : content.toString("base64")
    };
}

/** Resolves mime type from file extension. */
function filesMimeTypeResolve(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".json": "application/json",
        ".ts": "text/typescript",
        ".tsx": "text/typescript",
        ".js": "text/javascript",
        ".jsx": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".xml": "text/xml",
        ".yaml": "text/yaml",
        ".yml": "text/yaml",
        ".csv": "text/csv",
        ".log": "text/plain",
        ".sh": "text/x-shellscript",
        ".py": "text/x-python",
        ".rb": "text/x-ruby",
        ".rs": "text/x-rust",
        ".go": "text/x-go",
        ".sql": "text/x-sql",
        ".toml": "text/toml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".pdf": "application/pdf"
    };
    return map[ext] ?? "application/octet-stream";
}
