import { AsyncLocalStorage } from "node:async_hooks";

type LockScope = {
  readDepth: number;
  writeDepth: number;
};

/**
 * Runs async work under reader/writer exclusion with writer priority.
 * Expects: write lock is never acquired while already holding a read lock.
 * Note: queued writers block newly arriving readers to reduce reload latency.
 */
export class ReadWriteLock {
  private activeReaders = 0;
  private writerActive = false;
  private waitingReaders: Array<() => void> = [];
  private waitingWriters: Array<() => void> = [];
  private scope = new AsyncLocalStorage<LockScope>();

  async inReadLock<T>(func: () => Promise<T> | T): Promise<T> {
    const currentScope = this.scope.getStore();
    if ((currentScope?.writeDepth ?? 0) > 0 || (currentScope?.readDepth ?? 0) > 0) {
      const nestedScope: LockScope = {
        readDepth: (currentScope?.readDepth ?? 0) + 1,
        writeDepth: currentScope?.writeDepth ?? 0
      };
      return this.scope.run(nestedScope, async () => func());
    }

    await this.acquireRead();
    try {
      return await this.scope.run({ readDepth: 1, writeDepth: 0 }, async () => func());
    } finally {
      this.releaseRead();
    }
  }

  async inWriteLock<T>(func: () => Promise<T> | T): Promise<T> {
    const currentScope = this.scope.getStore();
    if ((currentScope?.writeDepth ?? 0) > 0) {
      const scope = currentScope;
      if (!scope) {
        throw new Error("Write lock scope missing.");
      }
      const nestedScope: LockScope = {
        readDepth: scope.readDepth,
        writeDepth: scope.writeDepth + 1
      };
      return this.scope.run(nestedScope, async () => func());
    }
    if ((currentScope?.readDepth ?? 0) > 0) {
      throw new Error("Cannot acquire write lock while holding read lock.");
    }

    await this.acquireWrite();
    try {
      return await this.scope.run({ readDepth: 0, writeDepth: 1 }, async () => func());
    } finally {
      this.releaseWrite();
    }
  }

  private async acquireRead(): Promise<void> {
    if (!this.writerActive && this.waitingWriters.length === 0) {
      this.activeReaders += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitingReaders.push(resolve);
    });
  }

  private releaseRead(): void {
    this.activeReaders -= 1;
    if (this.activeReaders < 0) {
      throw new Error("Read lock released too many times.");
    }
    if (this.activeReaders > 0) {
      return;
    }
    if (this.writerActive || this.waitingWriters.length === 0) {
      return;
    }
    this.writerActive = true;
    const wakeWriter = this.waitingWriters.shift();
    wakeWriter?.();
  }

  private async acquireWrite(): Promise<void> {
    if (!this.writerActive && this.activeReaders === 0) {
      this.writerActive = true;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitingWriters.push(resolve);
    });
  }

  private releaseWrite(): void {
    if (!this.writerActive) {
      throw new Error("Write lock released without acquisition.");
    }

    this.writerActive = false;
    if (this.waitingWriters.length > 0) {
      this.writerActive = true;
      const wakeWriter = this.waitingWriters.shift();
      wakeWriter?.();
      return;
    }

    if (this.waitingReaders.length === 0) {
      return;
    }

    const wakeReaders = this.waitingReaders.splice(0);
    this.activeReaders += wakeReaders.length;
    for (const wakeReader of wakeReaders) {
      wakeReader();
    }
  }
}
