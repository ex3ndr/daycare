/**
 * Builds a PascalCase response type name from a tool function name.
 * Expects: functionName is a Python identifier.
 */
export function montyResponseTypeNameFromFunction(functionName: string): string {
    const base = pascalCaseFromIdentifier(functionName);
    return `${base}Response`;
}

function pascalCaseFromIdentifier(value: string): string {
    const normalized = value.replace(/[^A-Za-z0-9]+/g, " ").trim();
    const source = normalized.length > 0 ? normalized : value;
    const parts = source.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) ?? [];
    const tokens = parts.map((part) => part.toLowerCase()).filter((part) => part.length > 0);
    if (tokens.length === 0) {
        return "Tool";
    }
    const candidate = tokens.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
    if (/^[0-9]/.test(candidate)) {
        return `Tool${candidate}`;
    }
    return candidate;
}
