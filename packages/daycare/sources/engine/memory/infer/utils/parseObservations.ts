import { tagExtract, tagExtractAll } from "../../../../util/tagExtract.js";
import type { InferObservation } from "../inferObservations.js";

/**
 * Parses XML observation response into structured observations.
 * Expects: text contains `<observation>` tags inside an `<observations>` root.
 */
export function parseObservations(text: string): InferObservation[] {
    return tagExtractAll(text, "observation")
        .map((observationBlock): InferObservation | null => {
            const observationText = tagExtract(observationBlock, "text");
            const observationContext = tagExtract(observationBlock, "context");
            if (observationText === null || observationContext === null) {
                return null;
            }
            if (observationText.length === 0 || observationContext.length === 0) {
                return null;
            }

            return {
                text: observationText,
                context: observationContext
            };
        })
        .filter((observation): observation is InferObservation => observation !== null);
}
