import type { AppManifest } from "./appTypes.js";

const APP_NAME_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/**
 * Validates and normalizes an app manifest.
 * Expects: manifest fields are parsed from APP.md and not nullish.
 */
export function appManifestValidate(manifest: AppManifest): AppManifest {
    const name = manifest.name.trim();
    const title = manifest.title.trim();
    const description = manifest.description.trim();
    const systemPrompt = manifest.systemPrompt.trim();
    if (!name || !title || !description || !systemPrompt) {
        throw new Error("App manifest requires name, title, description, and systemPrompt.");
    }
    if (!APP_NAME_PATTERN.test(name)) {
        throw new Error("App name must be username-style lowercase with optional dash or underscore separators.");
    }

    return {
        name,
        title,
        description,
        ...(manifest.model && manifest.model.trim().length > 0 ? { model: manifest.model.trim() } : {}),
        systemPrompt
    };
}
