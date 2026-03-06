import { Monty, MontyRuntimeError, MontySyntaxError } from "react-native-monty";

export type MontyFragmentResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

const FRAGMENT_LIMITS = {
    maxDurationSecs: 5,
    maxMemory: 10 * 1024 * 1024
} as const;

const INIT_PATTERN = /\bdef\s+init\s*\(/;

/**
 * Runs fragment Python `init()` and returns the initial state object.
 * Expects: code is Python source for a fragment; returns null when no init() is defined.
 */
export function montyFragmentInit(code: string): MontyFragmentResult | null {
    if (!INIT_PATTERN.test(code)) {
        return null;
    }

    return montyFragmentRun(code, "init()", undefined);
}

/**
 * Runs a named fragment Python action with the current state and action params.
 * Expects: actionName matches a Python function defined in code.
 */
export function montyFragmentAction(
    code: string,
    actionName: string,
    state: Record<string, unknown>,
    params: Record<string, unknown>
): MontyFragmentResult {
    return montyFragmentRun(code, `${actionName}(state, params)`, {
        state,
        params
    });
}

function montyFragmentRun(
    code: string,
    expression: string,
    inputs: Record<string, unknown> | undefined
): MontyFragmentResult {
    try {
        const program = new Monty(`${code}\n\n${expression}`, {
            scriptName: "fragment.py",
            inputs: inputs ? Object.keys(inputs) : undefined
        });
        const value = montyFragmentValueNormalize(
            program.run({
                inputs,
                limits: FRAGMENT_LIMITS
            })
        );
        if (!isRecord(value)) {
            return {
                ok: false,
                error: "Fragment Python must return an object."
            };
        }
        return {
            ok: true,
            value
        };
    } catch (error) {
        return {
            ok: false,
            error: montyFormatError(error)
        };
    }
}

function montyFormatError(error: unknown): string {
    if (error instanceof MontyRuntimeError || error instanceof MontySyntaxError) {
        return error.display("type-msg");
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function montyFragmentValueNormalize(value: unknown): unknown {
    if (typeof value === "bigint") {
        if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
            return Number(value);
        }
        return value.toString();
    }

    if (value instanceof Map) {
        const result: Record<string, unknown> = {};
        for (const [key, item] of value.entries()) {
            result[String(key)] = montyFragmentValueNormalize(item);
        }
        return result;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => montyFragmentValueNormalize(entry));
    }

    if (!isRecord(value)) {
        return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        result[key] = montyFragmentValueNormalize(item);
    }
    return result;
}
