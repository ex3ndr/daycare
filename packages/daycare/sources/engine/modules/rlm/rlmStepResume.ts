import { type MontyComplete, MontySnapshot } from "@pydantic/monty";
import type { RlmStepResumeOptions } from "./rlmStepToolCall.js";

/**
 * Resumes Monty execution from a serialized snapshot.
 * Expects: snapshotDump was captured from the paused VM immediately before resume.
 */
export function rlmStepResume(
    snapshotDump: Uint8Array,
    options: RlmStepResumeOptions,
    printCallback: (...values: unknown[]) => void
): MontySnapshot | MontyComplete {
    const restored = MontySnapshot.load(Buffer.from(snapshotDump), { printCallback });
    return restored.resume(options);
}
