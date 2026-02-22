import { tagExtractAll } from "../../../../util/tagExtract.js";
import type { InferObservation } from "../inferObservations.js";

/**
 * Parses XML observation response into structured observations.
 * Expects: text contains `<observation>` tags inside an `<observations>` root.
 */
export function parseObservations(text: string): InferObservation[] {
    return tagExtractAll(text, "observation")
        .filter((content) => content.length > 0)
        .map((content) => ({ content }));
}
