export type SecretsVariablesParseResult =
    | {
          ok: true;
          variables: Record<string, string>;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Parses and validates secret env variable mappings from request payloads.
 * Expects: input is a plain object with ENV-like names and string/number/boolean values.
 */
export function secretsVariablesParse(input: unknown, options: { allowEmpty: boolean }): SecretsVariablesParseResult {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { ok: false, error: "variables must be an object." };
    }

    const parsed: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
        const name = key.trim();
        if (!name) {
            return { ok: false, error: "variable names must be non-empty strings." };
        }
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            return { ok: false, error: `invalid variable name: ${name}` };
        }
        if (parsed[name] !== undefined) {
            return { ok: false, error: `duplicate variable name: ${name}` };
        }
        if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
            return {
                ok: false,
                error: `invalid value for variable ${name}: expected string, number, or boolean.`
            };
        }
        parsed[name] = String(value);
    }

    if (!options.allowEmpty && Object.keys(parsed).length === 0) {
        return { ok: false, error: "variables must include at least one entry." };
    }

    return { ok: true, variables: parsed };
}
