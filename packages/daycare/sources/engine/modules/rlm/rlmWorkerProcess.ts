import {
    Monty,
    type MontyComplete,
    MontyRuntimeError,
    MontySnapshot,
    MontySyntaxError,
    MontyTypingError
} from "@pydantic/monty";

import { rlmPrintCaptureAppend, rlmPrintCaptureCreate, rlmPrintCaptureFlushTrailing } from "./rlmPrintCapture.js";
import type { RlmWorkerRequest, RlmWorkerResponse, RlmWorkerSerializedError } from "./rlmWorkerProtocol.js";

const runtimePrelude = "ToolError = RuntimeError";

process.on("message", (value) => {
    void messageHandle(value);
});

async function messageHandle(value: unknown): Promise<void> {
    const request = requestParse(value);
    if (!request) {
        return;
    }

    try {
        const progress = request.type === "start" ? startHandle(request) : resumeHandle(request);
        await responseSend({
            id: request.id,
            ok: true,
            progress
        });
    } catch (error) {
        await responseSend({
            id: request.id,
            ok: false,
            error: errorSerialize(error)
        });
    }
}

function requestParse(value: unknown): RlmWorkerRequest | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const request = value as Partial<RlmWorkerRequest>;
    if (typeof request.id !== "string") {
        return null;
    }
    if (request.type !== "start" && request.type !== "resume") {
        return null;
    }
    if (typeof request.payload !== "object" || request.payload === null) {
        return null;
    }
    return request as RlmWorkerRequest;
}

function startHandle(
    request: Extract<RlmWorkerRequest, { type: "start" }>
): Extract<RlmWorkerResponse, { ok: true }>["progress"] {
    const printOutput: string[] = [];
    const printCapture = rlmPrintCaptureCreate(printOutput);
    const printCallback = (...values: unknown[]): void => {
        rlmPrintCaptureAppend(printCapture, values);
    };
    const script = `${runtimePrelude}\n\n${request.payload.code}`;
    const monty = new Monty(script, {
        scriptName: "run_python.py",
        externalFunctions: request.payload.externalFunctions,
        typeCheck: true,
        typeCheckPrefixCode: request.payload.preamble.length > 0 ? request.payload.preamble : undefined
    });
    const progress = monty.start({
        limits: request.payload.limits,
        printCallback
    });
    rlmPrintCaptureFlushTrailing(printCapture);
    return progressSerialize(progress, printOutput);
}

function resumeHandle(
    request: Extract<RlmWorkerRequest, { type: "resume" }>
): Extract<RlmWorkerResponse, { ok: true }>["progress"] {
    const printOutput: string[] = [];
    const printCapture = rlmPrintCaptureCreate(printOutput);
    const printCallback = (...values: unknown[]): void => {
        rlmPrintCaptureAppend(printCapture, values);
    };
    const restored = MontySnapshot.load(Buffer.from(request.payload.snapshot, "base64"), { printCallback });
    const progress = restored.resume(request.payload.options);
    rlmPrintCaptureFlushTrailing(printCapture);
    return progressSerialize(progress, printOutput);
}

function progressSerialize(
    progress: MontySnapshot | MontyComplete,
    printOutput: string[]
): Extract<RlmWorkerResponse, { ok: true }>["progress"] {
    if (progress instanceof MontySnapshot) {
        return {
            type: "snapshot",
            snapshot: Buffer.from(progress.dump()).toString("base64"),
            functionName: progress.functionName,
            args: [...progress.args],
            kwargs: { ...progress.kwargs },
            printOutput
        };
    }

    const complete = progress as MontyComplete;
    return {
        type: "complete",
        output: complete.output,
        printOutput
    };
}

function errorSerialize(error: unknown): RlmWorkerSerializedError {
    if (error instanceof MontySyntaxError) {
        const details = error.display("type-msg").trim();
        return {
            kind: "syntax",
            message: "Python syntax error.",
            details: details.length > 0 ? details : undefined
        };
    }
    if (error instanceof MontyRuntimeError) {
        const details = error.display("traceback").trim();
        return {
            kind: "runtime",
            message: "Python runtime error.",
            details: details.length > 0 ? details : undefined
        };
    }
    if (error instanceof MontyTypingError) {
        const details = error.displayDiagnostics("concise", false).trim();
        return {
            kind: "typing",
            message: "Python type check failed.",
            details: details.length > 0 ? details : undefined
        };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
        kind: "internal",
        message: message.length > 0 ? message : "Worker execution failed."
    };
}

async function responseSend(response: RlmWorkerResponse): Promise<void> {
    if (!process.send) {
        return;
    }
    await new Promise<void>((resolve, reject) => {
        process.send?.(response, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
