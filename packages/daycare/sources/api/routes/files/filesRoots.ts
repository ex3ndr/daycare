import type { FileRoot } from "./filesTypes.js";

/**
 * Returns the list of base directory roots available to the user.
 * These correspond to UserHome subdirectories under ~/home/.
 */
export function filesRoots(): { ok: true; roots: FileRoot[] } {
    return {
        ok: true,
        roots: [
            { id: "desktop", label: "Desktop", path: "desktop" },
            { id: "downloads", label: "Downloads", path: "downloads" },
            { id: "documents", label: "Documents", path: "documents" },
            { id: "developer", label: "Developer", path: "developer" },
            { id: "tmp", label: "Temporary", path: "tmp" }
        ]
    };
}
