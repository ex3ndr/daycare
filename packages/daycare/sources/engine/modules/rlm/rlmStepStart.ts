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
 * Expects: `preamble` is already runtime-normalized.
 */
export function rlmStepStart(options: RlmStepStartOptions): RlmStepStartResult {
    const script = [options.preamble, options.code].filter((chunk) => chunk.length > 0).join("\n\n");
    const monty = new Monty(script, {
        scriptName: "run_python.py",
        externalFunctions: options.externalFunctions,
        typeCheck: true
    });
    const progress = monty.start({
        limits: options.limits,
        printCallback: options.printCallback
    });
    return { monty, progress };
}
