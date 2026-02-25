import { Monty, type MontyComplete, type MontySnapshot } from "@pydantic/monty";

type RlmStepStartLimits = {
    maxDurationSecs: number;
    maxMemory: number;
    maxRecursionDepth: number;
    maxAllocations: number;
};

type RlmStepStartOptions = {
    code: string;
    preamble: string;
    externalFunctions: string[];
    limits: RlmStepStartLimits;
    printCallback: (...values: unknown[]) => void;
};

export type RlmStepStartResult = {
    monty: Monty;
    progress: MontySnapshot | MontyComplete;
};

/**
 * Starts a fresh Monty execution and returns the first progress value.
 * Expects: `preamble` contains type-check prefix stubs for Monty.
 */
export function rlmStepStart(options: RlmStepStartOptions): RlmStepStartResult {
    const runtimePrelude = "ToolError = RuntimeError";
    const script = `${runtimePrelude}\n\n${options.code}`;
    const monty = new Monty(script, {
        scriptName: "run_python.py",
        externalFunctions: options.externalFunctions,
        typeCheck: true,
        typeCheckPrefixCode: options.preamble.length > 0 ? options.preamble : undefined
    });
    const progress = monty.start({
        limits: options.limits,
        printCallback: options.printCallback
    });
    return { monty, progress };
}
