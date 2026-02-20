import matter from "gray-matter";

import type { AppManifest } from "./appTypes.js";

type AppFrontmatter = {
    name?: unknown;
    title?: unknown;
    description?: unknown;
    model?: unknown;
};

/**
 * Parses APP.md content into an AppManifest shape.
 * Expects: content contains YAML frontmatter with name/title/description and non-empty markdown body.
 */
export function appManifestParse(content: string): AppManifest {
    let parsed: ReturnType<typeof matter>;
    try {
        parsed = matter(content);
    } catch {
        throw new Error("Invalid APP.md frontmatter.");
    }

    const frontmatter = parsed.data as AppFrontmatter;
    const name = toOptionalString(frontmatter.name);
    const title = toOptionalString(frontmatter.title);
    const description = toOptionalString(frontmatter.description);
    if (!name || !title || !description) {
        throw new Error("APP.md frontmatter must include name, title, and description.");
    }

    const model = toOptionalString(frontmatter.model);
    const systemPrompt = parsed.content.trim();
    if (!systemPrompt) {
        throw new Error("APP.md must include a non-empty markdown body for the system prompt.");
    }

    return {
        name,
        title,
        description,
        ...(model ? { model } : {}),
        systemPrompt
    };
}

function toOptionalString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
