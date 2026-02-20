import { MontyRuntimeError, MontySyntaxError, MontyTypingError } from "@pydantic/monty";

/**
 * Formats an RLM execution error into the user-facing run_python tool text.
 * Expects: error is thrown by rlmExecute/rlmRestore or a delegated tool.
 */
export function rlmErrorTextBuild(error: unknown): string {
    if (error instanceof MontySyntaxError) {
        return ["Python syntax error. Fix the code and retry.", error.display("type-msg")].join("\n\n");
    }
    if (error instanceof MontyRuntimeError) {
        return ["Python runtime error.", error.display("traceback")].join("\n\n");
    }
    if (error instanceof MontyTypingError) {
        const details = error.displayDiagnostics("concise", false).trim();
        if (details.length === 0) {
            return "Python type check failed.";
        }
        return ["Python type check failed.", details].join("\n\n");
    }

    const message = error instanceof Error ? error.message : String(error);
    return `Python execution failed: ${message}`;
}
