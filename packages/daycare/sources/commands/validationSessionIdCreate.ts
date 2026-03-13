import { createId } from "@paralleldrive/cuid2";

/**
 * Creates an isolated inference session id for validation calls.
 * Expects: prefix identifies the validation flow so repeated checks never reuse provider session state.
 */
export function validationSessionIdCreate(prefix: string): string {
    return `${prefix}:${createId()}`;
}
