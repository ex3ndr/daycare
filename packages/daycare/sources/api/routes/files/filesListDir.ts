import { promises as fs } from "node:fs";
import path from "node:path";
import { pathResolveSecure } from "../../../sandbox/pathResolveSecure.js";
import type { FileEntry } from "./filesTypes.js";

export type FilesListDirInput = {
    homeDir: string;
    requestedPath: string;
};

export type FilesListDirResult =
    | { ok: true; path: string; entries: FileEntry[] }
    | { ok: false; error: string; statusCode: number };

/**
 * Lists directory contents for a path relative to user home.
 * Skips symlinks and dotfiles. Sorts directories first, then alphabetical.
 *
 * Expects: homeDir is absolute; requestedPath is user-supplied.
 */
export async function filesListDir(input: FilesListDirInput): Promise<FilesListDirResult> {
    const requested = input.requestedPath.trim();
    if (!requested) {
        return { ok: false, error: "path is required.", statusCode: 400 };
    }

    const absolutePath = path.resolve(input.homeDir, requested);

    // Verify the resolved path is within the home directory (follows symlinks)
    try {
        await pathResolveSecure([input.homeDir], absolutePath);
    } catch {
        return { ok: false, error: "Invalid path.", statusCode: 400 };
    }

    let dirents: import("node:fs").Dirent[];
    try {
        dirents = await fs.readdir(absolutePath, { withFileTypes: true });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return { ok: false, error: "Directory not found.", statusCode: 404 };
        }
        if ((error as NodeJS.ErrnoException).code === "ENOTDIR") {
            return { ok: false, error: "Path is not a directory.", statusCode: 400 };
        }
        throw error;
    }

    const entries: FileEntry[] = [];
    for (const dirent of dirents) {
        if (dirent.isSymbolicLink()) continue;
        if (dirent.name.startsWith(".")) continue;

        const entryPath = path.join(absolutePath, dirent.name);
        try {
            const stat = await fs.stat(entryPath);
            entries.push({
                name: dirent.name,
                type: dirent.isDirectory() ? "directory" : "file",
                size: stat.size,
                modifiedAt: Math.floor(stat.mtimeMs)
            });
        } catch {}
    }

    // Directories first, then alphabetical
    entries.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return { ok: true, path: requested, entries };
}
