import type { RlmVmProgress } from "./rlmVmProgress.js";
import { rlmWorkersSharedGet } from "./rlmWorkers.js";

type RlmStepStartLimits = {
    maxDurationSecs: number;
    maxMemory: number;
    maxRecursionDepth: number;
    maxAllocations: number;
};

type RlmStepStartOptions = {
    workerKey: string;
    code: string;
    preamble: string;
    externalFunctions: string[];
    limits: RlmStepStartLimits;
    inputs?: Record<string, unknown>;
    printCallback: (...values: unknown[]) => void;
};

export type RlmStepStartResult = {
    progress: RlmVmProgress;
};

/**
 * Starts a fresh Monty execution and returns the first progress value.
 * Expects: `preamble` contains type-check prefix stubs for Monty.
 */
export async function rlmStepStart(options: RlmStepStartOptions): Promise<RlmStepStartResult> {
    const started = await rlmWorkersSharedGet().start(options.workerKey, {
        code: options.code,
        preamble: options.preamble,
        externalFunctions: options.externalFunctions,
        limits: options.limits,
        inputs: options.inputs
    });
    for (const line of started.printOutput) {
        options.printCallback(line);
    }
    return { progress: started.progress };
}
