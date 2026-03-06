import { Monty, MontyRuntimeError, MontySyntaxError, runMontyAsync } from "react-native-monty";

type MontyExternalFunction = (...args: unknown[]) => unknown | Promise<unknown>;

export type MontyFragmentResult = { ok: true; value: unknown } | { ok: false; error: string };

export type MontyFragmentRunOptions = {
    externalFunctions?: Record<string, MontyExternalFunction>;
};

const FRAGMENT_LIMITS = {
    maxDurationSecs: 5,
    maxMemory: 10 * 1024 * 1024
} as const;

const INIT_PATTERN = /\b(?:async\s+def|def)\s+init\s*\(/;
const FRAGMENT_RUNTIME_HELPERS = `
async def __fragment_await_if_needed__(value):
    try:
        return await value
    except TypeError as error:
        if "can't be awaited" not in str(error):
            raise
        return value

async def __fragment_call__(func, *args):
    return await __fragment_await_if_needed__(func(*args))

def apply(change):
    current = get_state()
    try:
        updates = change(current)
    except TypeError as error:
        if "not callable" not in str(error):
            raise
        updates = change
    if updates is None:
        return current
    if not isinstance(updates, dict):
        raise TypeError("apply() expects a dict or callable returning a dict")
    _apply_state(updates)
    return get_state()
`;

/**
 * Runs fragment Python `init()` and returns its value when present.
 * Expects: code is Python source for a fragment; returns null when no init() is defined.
 */
export async function montyFragmentInit(
    code: string,
    options?: MontyFragmentRunOptions
): Promise<MontyFragmentResult | null> {
    if (!INIT_PATTERN.test(code)) {
        return null;
    }

    return montyFragmentRun(code, "await __fragment_call__(init)", undefined, options);
}

/**
 * Runs a named fragment Python action with action params.
 * Expects: actionName matches a Python function defined in code.
 */
export async function montyFragmentAction(
    code: string,
    actionName: string,
    params: Record<string, unknown>,
    options?: MontyFragmentRunOptions
): Promise<MontyFragmentResult> {
    return montyFragmentRun(code, `await __fragment_call__(${actionName}, params)`, { params }, options);
}

async function montyFragmentRun(
    code: string,
    expression: string,
    inputs: Record<string, unknown> | undefined,
    options?: MontyFragmentRunOptions
): Promise<MontyFragmentResult> {
    try {
        const program = new Monty(`${FRAGMENT_RUNTIME_HELPERS}\n${code}\n\n${expression}`, {
            scriptName: "fragment.py",
            inputs: inputs ? Object.keys(inputs) : undefined
        });
        const value = montyFragmentValueNormalize(
            await runMontyAsync(program, {
                inputs,
                externalFunctions: options?.externalFunctions,
                limits: FRAGMENT_LIMITS
            })
        );
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
