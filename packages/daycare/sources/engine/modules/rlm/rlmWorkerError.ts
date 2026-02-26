import type { RlmWorkerSerializedError } from "./rlmWorkerProtocol.js";

export type RlmWorkerErrorKind = "syntax" | "runtime" | "typing" | "internal" | "worker_crash" | "worker_protocol";

/**
 * Error thrown by the RLM worker bridge for both VM execution and worker-process failures.
 * Expects: kind is stable and can be used for user-facing formatting decisions.
 */
export class RlmWorkerError extends Error {
    readonly kind: RlmWorkerErrorKind;
    readonly details?: string;

    constructor(kind: RlmWorkerErrorKind, message: string, options?: { details?: string; cause?: unknown }) {
        super(message, { cause: options?.cause });
        this.name = "RlmWorkerError";
        this.kind = kind;
        this.details = options?.details;
    }
}

/**
 * Converts serialized worker-side errors into host-side typed errors.
 * Expects: error payload is produced by the rlm worker process.
 */
export function rlmWorkerErrorFromSerialized(error: RlmWorkerSerializedError): RlmWorkerError {
    const message = error.details ? `${error.message}\n\n${error.details}` : error.message;
    return new RlmWorkerError(error.kind, message, { details: error.details });
}
