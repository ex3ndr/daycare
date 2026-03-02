import { describe, expect, it } from "vitest";

import { ReadWriteLock } from "./readWriteLock.js";

function deferred<T>() {
    let resolve: ((value: T | PromiseLike<T>) => void) | null = null;
    let reject: ((reason?: unknown) => void) | null = null;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {
        promise,
        resolve: (value: T) => resolve?.(value),
        reject: (reason?: unknown) => reject?.(reason)
    };
}

describe("ReadWriteLock", () => {
    it("allows multiple concurrent readers", async () => {
        const lock = new ReadWriteLock();
        const gate = deferred<void>();
        const events: string[] = [];

        const firstReader = lock.inReadLock(async () => {
            events.push("reader-1-start");
            await gate.promise;
            events.push("reader-1-end");
        });
        const secondReader = lock.inReadLock(async () => {
            events.push("reader-2-start");
            await gate.promise;
            events.push("reader-2-end");
        });

        await Promise.resolve();
        expect(events).toEqual(["reader-1-start", "reader-2-start"]);

        gate.resolve();
        await Promise.all([firstReader, secondReader]);
        expect(events).toEqual(["reader-1-start", "reader-2-start", "reader-1-end", "reader-2-end"]);
    });

    it("blocks new readers while a writer is queued", async () => {
        const lock = new ReadWriteLock();
        const readerGate = deferred<void>();
        const writerGate = deferred<void>();
        const writerStarted = deferred<void>();
        const events: string[] = [];

        const firstReader = lock.inReadLock(async () => {
            events.push("reader-1-start");
            await readerGate.promise;
            events.push("reader-1-end");
        });

        await Promise.resolve();

        const writer = lock.inWriteLock(async () => {
            events.push("writer-start");
            writerStarted.resolve();
            await writerGate.promise;
            events.push("writer-end");
        });
        const secondReader = lock.inReadLock(async () => {
            events.push("reader-2-start");
        });

        await Promise.resolve();
        expect(events).toEqual(["reader-1-start"]);

        readerGate.resolve();
        await writerStarted.promise;
        expect(events).toEqual(["reader-1-start", "reader-1-end", "writer-start"]);

        writerGate.resolve();
        await writer;
        await secondReader;
        await firstReader;
        expect(events).toEqual(["reader-1-start", "reader-1-end", "writer-start", "writer-end", "reader-2-start"]);
    });

    it("blocks writer until active readers finish", async () => {
        const lock = new ReadWriteLock();
        const readerGate = deferred<void>();
        const writerStarted = deferred<void>();

        const reader = lock.inReadLock(async () => {
            await readerGate.promise;
        });
        await Promise.resolve();

        const writer = lock.inWriteLock(async () => {
            writerStarted.resolve();
        });

        await Promise.resolve();
        expect(await Promise.race([writerStarted.promise.then(() => true), Promise.resolve(false)])).toBe(false);

        readerGate.resolve();
        await writerStarted.promise;
        await writer;
        await reader;
    });
});
