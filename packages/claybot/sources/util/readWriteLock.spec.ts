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
    expect(events).toEqual([
      "reader-1-start",
      "reader-2-start",
      "reader-1-end",
      "reader-2-end"
    ]);
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
    expect(events).toEqual([
      "reader-1-start",
      "reader-1-end",
      "writer-start",
      "writer-end",
      "reader-2-start"
    ]);
  });

  it("supports nested read locks while a writer is waiting", async () => {
    const lock = new ReadWriteLock();
    const nestedStart = deferred<void>();
    const outerGate = deferred<void>();
    const writerDone = deferred<void>();
    const nestedDone = deferred<void>();

    const reader = lock.inReadLock(async () => {
      await nestedStart.promise;
      await lock.inReadLock(async () => {
        nestedDone.resolve();
      });
      await outerGate.promise;
    });

    await Promise.resolve();
    const writer = lock.inWriteLock(async () => {
      writerDone.resolve();
    });

    nestedStart.resolve();
    await nestedDone.promise;
    expect(await Promise.race([writerDone.promise.then(() => true), Promise.resolve(false)])).toBe(false);

    outerGate.resolve();
    await writerDone.promise;
    await writer;
    await writerDone.promise;
    await reader;
  });

  it("rejects read-to-write lock upgrade", async () => {
    const lock = new ReadWriteLock();
    await expect(
      lock.inReadLock(async () => lock.inWriteLock(async () => "nope"))
    ).rejects.toThrow("Cannot acquire write lock while holding read lock.");
  });
});
