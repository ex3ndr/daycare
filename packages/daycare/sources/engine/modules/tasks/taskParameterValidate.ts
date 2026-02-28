import type { TaskParameter } from "./taskParameterTypes.js";

/**
 * Validates parameter values against a task's parameter schema.
 * Returns an error message string if validation fails, or null if valid.
 *
 * Expects: params is a non-empty array, values is a plain object.
 */
export function taskParameterValidate(params: TaskParameter[], values: Record<string, unknown>): string | null {
    for (const param of params) {
        const value = values[param.name];

        if (value === undefined || value === null) {
            if (!param.nullable) {
                return `Required parameter "${param.name}" is missing.`;
            }
            continue;
        }

        if (param.type === "any") {
            continue;
        }

        const error = taskParameterTypeCheck(param.name, param.type, value);
        if (error) {
            return error;
        }
    }

    return null;
}

function taskParameterTypeCheck(name: string, type: TaskParameter["type"], value: unknown): string | null {
    switch (type) {
        case "number":
            if (typeof value !== "number") {
                return `Parameter "${name}" expects number, got ${typeof value}.`;
            }
            break;
        case "string":
            if (typeof value !== "string") {
                return `Parameter "${name}" expects string, got ${typeof value}.`;
            }
            break;
        case "boolean":
            if (typeof value !== "boolean") {
                return `Parameter "${name}" expects boolean, got ${typeof value}.`;
            }
            break;
    }
    return null;
}
