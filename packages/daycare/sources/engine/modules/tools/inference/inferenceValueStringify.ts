/**
 * Normalizes a tool input value into non-empty text for inference prompts.
 * Expects: fieldName is a stable human-readable argument label for errors.
 */
export function inferenceValueStringify(value: unknown, fieldName: string): string {
    if (typeof value === "string") {
        const text = value.trim();
        if (text.length === 0) {
            throw new Error(`${fieldName} is required.`);
        }
        return text;
    }
    if (typeof value === "undefined") {
        throw new Error(`${fieldName} is required.`);
    }

    let serialized = "";
    try {
        serialized = JSON.stringify(value);
    } catch {
        throw new Error(`${fieldName} could not be serialized.`);
    }
    if (typeof serialized !== "string" || serialized.trim().length === 0) {
        throw new Error(`${fieldName} could not be serialized.`);
    }
    return serialized;
}
