import type { TaskParameter } from "./taskParameterTypes.js";

/**
 * Normalizes input values against a parameter schema.
 * Fills in omitted schema parameters with null so Monty injects them as None.
 *
 * Expects: values have already been validated via taskParameterValidate.
 */
export function taskParameterInputsNormalize(
    params: TaskParameter[],
    values: Record<string, unknown>
): Record<string, unknown> {
    const schemaNames = new Set(params.map((p) => p.name));
    const result: Record<string, unknown> = {};
    // Only copy keys declared in the schema
    for (const key of Object.keys(values)) {
        if (schemaNames.has(key)) {
            result[key] = values[key];
        }
    }
    // Fill all missing params with null (required params should already be present after validation).
    for (const param of params) {
        if (!(param.name in result)) {
            result[param.name] = null;
        }
    }
    return result;
}
