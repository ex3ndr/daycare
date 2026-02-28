/**
 * Supported parameter types for task definitions.
 * Maps to Python (int|float, str, bool, Any) and TypeScript (number, string, boolean, unknown).
 */
export type TaskParameterType = "number" | "string" | "boolean" | "any";

/**
 * A single parameter definition in a task's parameter schema.
 * When nullable is true, the parameter can be omitted or null (defaults to None in Python).
 * When nullable is false, the parameter must always be provided with a non-null value.
 */
export type TaskParameter = {
    name: string;
    type: TaskParameterType;
    nullable: boolean;
};
