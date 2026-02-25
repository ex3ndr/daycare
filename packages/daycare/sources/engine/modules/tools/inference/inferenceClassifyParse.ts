import { inferenceSummaryParse } from "./inferenceSummaryParse.js";

export type InferenceClassifyResult = {
    summary: string;
    class: string;
};

/**
 * Parses classify output and validates the class against known variants.
 * Expects: validClasses contains exact class names allowed by the tool request.
 */
export function inferenceClassifyParse(text: string, validClasses: string[]): InferenceClassifyResult {
    const classMatch = /<class>([\s\S]*?)<\/class>/i.exec(text);
    if (!classMatch) {
        throw new Error("Missing <class> tag in inference output.");
    }

    const resolvedClass = (classMatch[1] ?? "").trim();
    if (!resolvedClass) {
        throw new Error("Parsed <class> value is empty.");
    }
    if (!validClasses.includes(resolvedClass)) {
        throw new Error(`Invalid class "${resolvedClass}". Expected one of: ${validClasses.join(", ")}`);
    }

    return {
        summary: inferenceSummaryParse(text).trim(),
        class: resolvedClass
    };
}
