import type { InferObservation } from "../inferObservations.js";

/**
 * Parses XML observation response into structured observations.
 * Expects: text contains `<observation>` tags inside an `<observations>` root.
 */
export function parseObservations(text: string): InferObservation[] {
    const observations: InferObservation[] = [];
    const regex = /<observation>([\s\S]*?)<\/observation>/g;
    let match = regex.exec(text);
    while (match !== null) {
        const content = (match[1] ?? "").trim();
        if (content.length > 0) {
            observations.push({ content });
        }
        match = regex.exec(text);
    }
    return observations;
}
