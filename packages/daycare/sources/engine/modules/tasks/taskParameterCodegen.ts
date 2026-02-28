import type { TaskParameter, TaskParameterType } from "./taskParameterTypes.js";

/**
 * Generates Python preamble stubs for type-checking task code during rlmVerify.
 * Produces typed variable assignments so the type checker can verify code
 * that references parameters. Nullable params default to None.
 *
 * Expects: params is the task's parameter schema.
 */
export function taskParameterPreambleStubs(params: TaskParameter[]): string {
    if (params.length === 0) {
        return "";
    }

    const needsAnyImport = params.some((p) => p.type === "any");
    const lines: string[] = [];
    if (needsAnyImport) {
        lines.push("from typing import Any");
    }
    for (const param of params) {
        const pyType = pythonTypeAnnotation(param.type, param.nullable);
        const defaultValue = param.nullable ? "None" : pythonDefaultValue(param.type);
        lines.push(`${param.name}: ${pyType} = ${defaultValue}`);
    }

    return lines.join("\n");
}

function pythonTypeAnnotation(type: TaskParameterType, nullable: boolean): string {
    const base = pythonBaseType(type);
    return nullable ? `${base} | None` : base;
}

function pythonBaseType(type: TaskParameterType): string {
    switch (type) {
        case "integer":
            return "int";
        case "float":
            return "float";
        case "string":
            return "str";
        case "boolean":
            return "bool";
        case "any":
            return "Any";
    }
}

function pythonDefaultValue(type: TaskParameterType): string {
    switch (type) {
        case "integer":
            return "0";
        case "float":
            return "0.0";
        case "string":
            return '""';
        case "boolean":
            return "False";
        case "any":
            return "None";
    }
}
