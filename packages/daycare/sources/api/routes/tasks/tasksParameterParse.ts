import type { TaskParameter } from "../../../engine/modules/tasks/taskParameterTypes.js";

const TASK_PARAMETER_TYPES = new Set(["integer", "float", "string", "boolean", "any"] as const);

/**
 * Parses and validates a task parameter schema array.
 * Expects: each item has { name, type, nullable }.
 */
export function tasksParameterParse(
    value: unknown
): { ok: true; parameters: TaskParameter[] } | { ok: false; error: string } {
    if (!Array.isArray(value)) {
        return { ok: false, error: "parameters must be an array." };
    }

    const parsed: TaskParameter[] = [];
    for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return { ok: false, error: `parameters[${index}] must be an object.` };
        }

        const nameRaw = Reflect.get(item, "name");
        const typeRaw = Reflect.get(item, "type");
        const nullableRaw = Reflect.get(item, "nullable");

        if (typeof nameRaw !== "string" || nameRaw.trim().length === 0) {
            return { ok: false, error: `parameters[${index}].name is required.` };
        }
        if (typeof typeRaw !== "string" || !TASK_PARAMETER_TYPES.has(typeRaw as TaskParameter["type"])) {
            return { ok: false, error: `parameters[${index}].type is invalid.` };
        }
        if (typeof nullableRaw !== "boolean") {
            return { ok: false, error: `parameters[${index}].nullable must be boolean.` };
        }

        parsed.push({
            name: nameRaw.trim(),
            type: typeRaw as TaskParameter["type"],
            nullable: nullableRaw
        });
    }

    return { ok: true, parameters: parsed };
}
