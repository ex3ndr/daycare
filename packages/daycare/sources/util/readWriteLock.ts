/**
 * Runs async work under reader/writer exclusion with writer priority.
 * Note: queued writers block newly arriving readers to reduce reload latency.
 */
export class ReadWriteLock {
    private activeReaders = 0;
    private writerActive = false;
    private waitingReaders: Array<() => void> = [];
    private waitingWriters: Array<() => void> = [];

    async inReadLock<T>(func: () => Promise<T> | T): Promise<T> {
        await this.acquireRead();
        try {
            return await func();
        } finally {
            this.releaseRead();
        }
    }

    async inWriteLock<T>(func: () => Promise<T> | T): Promise<T> {
        await this.acquireWrite();
        try {
            return await func();
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
