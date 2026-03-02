import { getLogger } from "../log.js";

type ShutdownHandler = () => void | Promise<void>;

export type ShutdownSignal = {
    readonly aborted: boolean;
    addEventListener: (type: "abort", listener: () => void) => void;
    removeEventListener: (type: "abort", listener: () => void) => void;
};

const shutdownHandlers = new Map<string, ShutdownHandler[]>();
const shutdownController = new AbortController();
const FORCE_EXIT_MS = 500;
let shutdownPromise: Promise<NodeJS.Signals | "fatal"> | null = null;
let resolveShutdown: ((signal: NodeJS.Signals | "fatal") => void) | null = null;
let shutdownRequestedSignal: NodeJS.Signals | "fatal" | null = null;
let shutdownCompletion: Promise<void> | null = null;
let handlersAttached = false;
let shuttingDown = false;
const logger = getLogger("shutdown");

export const shutdownSignal: ShutdownSignal = shutdownController.signal;

export function onShutdown(name: string, handler: ShutdownHandler): () => void {
    if (shutdownSignal.aborted) {
        void handler();
        return () => {};
    }

    const handlers = shutdownHandlers.get(name) ?? [];
    handlers.push(handler);
    shutdownHandlers.set(name, handlers);

    return () => {
        const list = shutdownHandlers.get(name);
        if (!list) {
            return;
        }
        const index = list.indexOf(handler);
        if (index !== -1) {
            list.splice(index, 1);
        }
        if (list.length === 0) {
            shutdownHandlers.delete(name);
        }
    };
}

export function isShutdown(): boolean {
    return shutdownSignal.aborted;
}

export async function awaitShutdown(): Promise<NodeJS.Signals | "fatal"> {
    if (!shutdownPromise) {
        shutdownPromise = new Promise((resolve) => {
            resolveShutdown = resolve;
            const handler = (signal: NodeJS.Signals) => {
                requestShutdown(signal);
            };

            if (!handlersAttached) {
                handlersAttached = true;
                process.once("SIGINT", handler);
                process.once("SIGTERM", handler);
            }

            if (shutdownRequestedSignal) {
                resolveWhenComplete(shutdownRequestedSignal);
            }
        });
    }

    return shutdownPromise;
}

export function requestShutdown(signal: NodeJS.Signals | "fatal" = "SIGTERM"): void {
    if (shutdownRequestedSignal) {
        return;
    }
    shutdownRequestedSignal = signal;
    shutdownCompletion = triggerShutdown(signal);
    resolveWhenComplete(signal);
}

function resolveWhenComplete(signal: NodeJS.Signals | "fatal"): void {
    if (!resolveShutdown) {
        return;
    }
    const completion = shutdownCompletion ?? Promise.resolve();
    completion.then(() => resolveShutdown?.(signal));
}

async function triggerShutdown(_signal: NodeJS.Signals | "fatal"): Promise<void> {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    shutdownController.abort();

    const forceExit = setTimeout(() => {
        logger.warn(`event: Shutdown: forcing exit after ${FORCE_EXIT_MS}ms`);
        process.exit(1);
    }, FORCE_EXIT_MS);
    forceExit.unref();

    const snapshot = new Map<string, ShutdownHandler[]>();
    for (const [name, handlers] of shutdownHandlers) {
        snapshot.set(name, [...handlers]);
    }

    const totalHandlers = Array.from(snapshot.values()).reduce((total, handlers) => total + handlers.length, 0);

    logger.info(`event: Shutdown: running ${totalHandlers} handler${totalHandlers === 1 ? "" : "s"}`);

    const tasks: Promise<unknown>[] = [];
    for (const [name, handlers] of snapshot) {
        if (handlers.length > 0) {
            logger.info(`start: Shutdown: starting ${handlers.length} handler(s) for ${name}`);
        }
        handlers.forEach((handler, index) => {
            tasks.push(
                Promise.resolve()
                    .then(() => handler())
                    .catch((error) => {
                        logger.warn({ error }, `event: Shutdown: handler ${name}[${index + 1}] failed`);
                    })
            );
        });
    }

    if (totalHandlers > 0) {
        logger.info(`event: Shutdown: waiting for ${totalHandlers} handler${totalHandlers === 1 ? "" : "s"}`);
    } else {
        logger.info("register: Shutdown: no handlers registered");
    }

    if (tasks.length > 0) {
        const startedAt = Date.now();
        await Promise.allSettled(tasks);
        const elapsedMs = Date.now() - startedAt;
        logger.info(
            `event: Shutdown: completed ${totalHandlers} handler${totalHandlers === 1 ? "" : "s"} in ${elapsedMs}ms`
        );
    }

    clearTimeout(forceExit);
}
