import { promises as fs } from "node:fs";
import path from "node:path";
import type { Context } from "@/types";
import type { Secret } from "./secretTypes.js";

/**
 * Loads all user secrets from `<usersDir>/<encodedUserId>/secrets.json`.
 * Expects: usersDir points to the runtime users root.
 */
export async function secretLoad(usersDir: string, ctx: Context): Promise<Secret[]> {
    const filePath = secretPathResolve(usersDir, ctx);
    let content = "";
    try {
        content = await fs.readFile(filePath, "utf8");
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
            return [];
        }
        throw error;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid secrets file at ${filePath}: ${message}`);
    }

    return secretsParse(filePath, parsed);
}

function secretsParse(filePath: string, value: unknown): Secret[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid secrets file at ${filePath}: expected an array.`);
    }

    const secrets: Secret[] = [];
    for (const [index, item] of value.entries()) {
        if (!recordIs(item)) {
            throw new Error(`Invalid secrets file at ${filePath}: secret at index ${index} must be an object.`);
        }
        const name = item.name;
        const displayName = item.displayName;
        const description = item.description;
        const variables = item.variables;
        if (typeof name !== "string" || typeof displayName !== "string" || typeof description !== "string") {
            throw new Error(`Invalid secrets file at ${filePath}: secret at index ${index} has invalid string fields.`);
        }
        if (!recordIs(variables)) {
            throw new Error(
                `Invalid secrets file at ${filePath}: secret at index ${index} variables must be an object.`
            );
        }

        const normalizedVariables: Record<string, string> = {};
        for (const [key, entryValue] of Object.entries(variables)) {
            if (typeof key !== "string" || key.trim().length === 0 || typeof entryValue !== "string") {
                throw new Error(
                    `Invalid secrets file at ${filePath}: secret at index ${index} contains invalid variables.`
                );
            }
            normalizedVariables[key] = entryValue;
        }

        secrets.push({
            name,
            displayName,
            description,
            variables: normalizedVariables
        });
    }

    return secrets;
}

function secretPathResolve(usersDir: string, ctx: Context): string {
    return path.join(path.resolve(usersDir), encodeURIComponent(ctx.userId), "secrets.json");
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
