import { Value } from "@sinclair/typebox/value";

/**
 * Formats TypeBox validation failures into a readable schema mismatch message.
 * Expects: schema is a TypeBox-compatible schema and value is the converted payload being checked.
 */
export function montySchemaMismatchMessageBuild(schema: unknown, value: unknown, label: string): string {
    const fallback = `${label} does not match its declared schema after conversion.`;
    if (!recordIs(schema)) {
        return fallback;
    }

    try {
        const errors = Array.from(Value.Errors(schema as never, value));
        if (errors.length === 0) {
            return fallback;
        }

        const messages = errors.slice(0, 3).map((error) => {
            const suffix = pathSuffixBuild(error.path);
            const message =
                typeof error.message === "string" && error.message.trim().length > 0
                    ? error.message
                    : "Schema validation failed.";
            return `${label}${suffix} ${message}`;
        });
        return messages.join("; ");
    } catch {
        return fallback;
    }
}

function pathSuffixBuild(path: string): string {
    if (!path || path === "/") {
        return "";
    }

    const segments = path
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

    let suffix = "";
    for (const segment of segments) {
        suffix += /^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`;
    }
    return suffix;
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
