import matter from "gray-matter";

import type { AppManifest } from "./appTypes.js";

/**
 * Serializes an app manifest back to APP.md markdown format.
 * Expects: manifest has already been validated and normalized.
 */
export function appManifestSerialize(manifest: AppManifest): string {
    return matter.stringify(manifest.systemPrompt.trim(), {
        name: manifest.name,
        title: manifest.title,
        description: manifest.description,
        ...(manifest.model ? { model: manifest.model } : {})
    });
}
