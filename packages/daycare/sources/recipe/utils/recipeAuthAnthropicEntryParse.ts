import type { OAuthCredentials } from "@mariozechner/pi-ai";

/**
 * Parses an Anthropic auth entry and returns OAuth credentials without the `type` field.
 * Expects: entry must be an object with `type: "oauth"`.
 */
export function recipeAuthAnthropicEntryParse(entry: unknown): OAuthCredentials {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error("Expected anthropic auth entry to be an object.");
    }

    const typedEntry = entry as Record<string, unknown>;
    if (typedEntry.type !== "oauth") {
        throw new Error('Expected anthropic auth entry with type "oauth".');
    }

    const { type: _type, ...credentials } = typedEntry;
    return credentials as OAuthCredentials;
}
