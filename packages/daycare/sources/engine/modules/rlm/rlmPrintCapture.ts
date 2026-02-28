import { rlmValueFormat } from "./rlmValueFormat.js";

export type RlmPrintCaptureState = {
    buffer: string;
    lines: string[];
};

/**
 * Creates mutable print-capture state shared across Monty start/resume calls.
 * Expects: `lines` is the destination array for finalized print lines.
 */
export function rlmPrintCaptureCreate(lines: string[]): RlmPrintCaptureState {
    return { buffer: "", lines };
}

/**
 * Appends one print callback invocation into capture state.
 * Expects: Monty stdout/stderr callback tuples or arbitrary value lists.
 */
export function rlmPrintCaptureAppend(state: RlmPrintCaptureState, args: unknown[]): void {
    if (args.length >= 2 && (args[0] === "stdout" || args[0] === "stderr") && typeof args[1] === "string") {
        if (args[0] !== "stdout") {
            return;
        }
        state.buffer += args[1];
        printCaptureConsumeLines(state);
        return;
    }

    state.lines.push(printLineBuild(args));
}

/**
 * Appends one tool-originated print callback invocation into capture state.
 * Expects: stream selector and text chunk, same tuple shape as Monty print callback.
 */
export function rlmPrintCaptureAppendToolPrint(
    state: RlmPrintCaptureState,
    stream: "stdout" | "stderr",
    text: string
): void {
    rlmPrintCaptureAppend(state, [stream, text]);
}

/**
 * Flushes trailing stdout buffer content that has no trailing newline.
 * Expects: called before reading captured print output for persistence/output.
 */
export function rlmPrintCaptureFlushTrailing(state: RlmPrintCaptureState): void {
    if (state.buffer.length === 0) {
        return;
    }
    state.lines.push(state.buffer.replace(/\r$/, "").trimEnd());
    state.buffer = "";
}

function printCaptureConsumeLines(state: RlmPrintCaptureState): void {
    let newlineIndex = state.buffer.indexOf("\n");
    while (newlineIndex >= 0) {
        const line = state.buffer.slice(0, newlineIndex).replace(/\r$/, "");
        state.lines.push(line.trimEnd());
        state.buffer = state.buffer.slice(newlineIndex + 1);
        newlineIndex = state.buffer.indexOf("\n");
    }
}

function printLineBuild(args: unknown[]): string {
    return args
        .map((entry) => rlmValueFormat(entry))
        .join(" ")
        .trimEnd();
}
