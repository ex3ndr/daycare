import type { TaskParameter, TaskParameterType } from "./taskParameterTypes.js";

/**
 * Prepends Python variable declarations to task code based on parameter schema and values.
 * Expects: params and values have already been validated via taskParameterValidate.
 */
export function taskParameterCodePrepend(
    code: string,
    params: TaskParameter[],
    values: Record<string, unknown>
): string {
    if (params.length === 0) {
        return code;
    }

    const lines: string[] = [];
    for (const param of params) {
        const value = values[param.name];
        const pyType = pythonTypeAnnotation(param.type, param.nullable);
        const pyValue = pythonValueLiteral(value);
        lines.push(`${param.name}: ${pyType} = ${pyValue}`);
    }

    return `${lines.join("\n")}\n\n${code}`;
}

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

function pythonValueLiteral(value: unknown): string {
    if (value === null || value === undefined) {
        return "None";
    }
    if (typeof value === "boolean") {
        return value ? "True" : "False";
    }
    if (typeof value === "number") {
        return String(value);
    }
    if (typeof value === "string") {
        return pythonStringLiteral(value);
    }
    // Objects/arrays: serialize as JSON string
    return pythonStringLiteral(JSON.stringify(value));
}

function pythonStringLiteral(value: string): string {
    // Use triple-quoted strings to handle any content safely
    if (!value.includes('"""') && !value.endsWith('"')) {
        return `"""${value}"""`;
    }
    if (!value.includes("'''") && !value.endsWith("'")) {
        return `'''${value}'''`;
    }
    // Fallback: escape backslashes and quotes
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
}
