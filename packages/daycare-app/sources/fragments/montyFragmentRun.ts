import { Monty, MontyRuntimeError, MontySyntaxError, runMontyAsync } from "react-native-monty";

type MontyExternalFunction = (...args: unknown[]) => unknown | Promise<unknown>;

export type MontyFragmentResult =
    | { ok: true; value: unknown; state: Record<string, unknown> | null; stateDirty: boolean }
    | { ok: false; error: string };

export type MontyFragmentRunOptions = {
    externalFunctions?: Record<string, MontyExternalFunction>;
    state?: Record<string, unknown>;
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

def __fragment_clone__(value):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            result[key] = __fragment_clone__(item)
        return result
    if isinstance(value, list):
        result = []
        for item in value:
            result.append(__fragment_clone__(item))
        return result
    return value

def __fragment_state_merge__(current, changes):
    if not isinstance(current, dict) or not isinstance(changes, dict):
        return __fragment_clone__(changes)
    result = __fragment_clone__(current)
    for key, value in changes.items():
        if key in result and isinstance(result.get(key), dict) and isinstance(value, dict):
            result[key] = __fragment_state_merge__(result.get(key), value)
        else:
            result[key] = __fragment_clone__(value)
    return result

__fragment_state__ = __fragment_clone__(__fragment_initial_state)
__fragment_state_dirty__ = False

def get_state():
    return __fragment_clone__(__fragment_state__)

def apply(change):
    global __fragment_state__
    global __fragment_state_dirty__
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
    __fragment_state__ = __fragment_state_merge__(__fragment_state__, updates)
    __fragment_state_dirty__ = True
    return get_state()

async def __fragment_execute__(func, *args):
    result = await __fragment_call__(func, *args)
    return {
        "__fragment_result__": result,
        "__fragment_state__": get_state(),
        "__fragment_state_dirty__": __fragment_state_dirty__,
    }
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

    return montyFragmentRun(code, "await __fragment_execute__(init)", undefined, options);
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
    return montyFragmentRun(code, `await __fragment_execute__(${actionName}, params)`, { params }, options);
}

async function montyFragmentRun(
    code: string,
    expression: string,
    inputs: Record<string, unknown> | undefined,
    options?: MontyFragmentRunOptions
): Promise<MontyFragmentResult> {
    try {
        const runtimeInputs = {
            __fragment_initial_state: options?.state ?? {},
            ...(inputs ?? {})
        };
        const program = new Monty(`${FRAGMENT_RUNTIME_HELPERS}\n${code}\n\n${expression}`, {
            scriptName: "fragment.py",
            inputs: Object.keys(runtimeInputs)
        });
        const output = montyFragmentResultRead(
            await runMontyAsync(program, {
                inputs: runtimeInputs,
                externalFunctions: options?.externalFunctions,
                limits: FRAGMENT_LIMITS
            })
        );
        return {
            ok: true,
            value: output.value,
            state: output.state,
            stateDirty: output.stateDirty
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

function montyFragmentResultRead(value: unknown): {
    value: unknown;
    state: Record<string, unknown> | null;
    stateDirty: boolean;
} {
    const normalized = montyFragmentValueNormalize(value);
    if (!isRecord(normalized)) {
        return {
            value: normalized,
            state: null,
            stateDirty: false
        };
    }

    const rawValue = normalized.__fragment_result__;
    const rawState = normalized.__fragment_state__;
    const rawStateDirty = normalized.__fragment_state_dirty__;
    const hasEnvelope =
        Object.hasOwn(normalized, "__fragment_result__") ||
        Object.hasOwn(normalized, "__fragment_state__") ||
        Object.hasOwn(normalized, "__fragment_state_dirty__");

    if (!hasEnvelope) {
        return {
            value: normalized,
            state: null,
            stateDirty: false
        };
    }

    return {
        value: rawValue,
        state: isRecord(rawState) ? rawState : null,
        stateDirty: rawStateDirty === true
    };
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
