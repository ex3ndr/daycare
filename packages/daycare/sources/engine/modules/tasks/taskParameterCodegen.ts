import type { TaskParameter, TaskParameterType } from "./taskParameterTypes.js";

/**
 * Generates Python preamble stubs for type-checking task code during rlmVerify.
 * Produces type-annotated variable declarations without values so the type checker
 * can verify code that references parameters.
 *
 * Expects: params is the task's parameter schema.
 */
export function taskParameterPreambleStubs(params: TaskParameter[]): string {
    if (params.length === 0) {
        return "";
    }

    const lines: string[] = [];
    for (const param of params) {
        const pyType = pythonTypeAnnotation(param.type, param.nullable);
        lines.push(`${param.name}: ${pyType}`);
    }

    return lines.join("\n");
}

function pythonTypeAnnotation(type: TaskParameterType, nullable: boolean): string {
    const base = pythonBaseType(type);
    return nullable ? `${base} | None` : base;
}

function pythonBaseType(type: TaskParameterType): string {
    switch (type) {
        case "number":
            return "int | float";
        case "string":
            return "str";
        case "boolean":
            return "bool";
        case "any":
            return "Any";
    }
}
