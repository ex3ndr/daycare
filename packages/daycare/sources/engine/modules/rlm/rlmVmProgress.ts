/**
 * Represents a paused VM state that can be resumed from a serialized snapshot dump.
 * Expects: dump() returns the exact snapshot bytes produced by Monty.
 */
export type RlmVmSnapshot = {
    functionName: string;
    args: unknown[];
    kwargs: Record<string, unknown>;
    dump: () => Uint8Array;
};

export type RlmVmComplete = {
    output: unknown;
};

export type RlmVmProgress = RlmVmSnapshot | RlmVmComplete;

/**
 * Checks whether VM progress is paused at an external tool call.
 * Expects: value is returned by rlmStepStart()/rlmStepResume().
 */
export function rlmVmSnapshotIs(value: RlmVmProgress): value is RlmVmSnapshot {
    return "functionName" in value && typeof value.dump === "function";
}
