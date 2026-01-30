import { backoff } from "./time.js";

export class InvalidateSync {
  private invalidated = false;
  private invalidatedDouble = false;
  private stopped = false;
  private command: () => Promise<void>;
  private pendings: Array<() => void> = [];

  constructor(command: () => Promise<void>) {
    this.command = command;
  }

  invalidate(): void {
    if (this.stopped) {
      return;
    }
    if (!this.invalidated) {
      this.invalidated = true;
      this.invalidatedDouble = false;
      void this.doSync();
    } else if (!this.invalidatedDouble) {
      this.invalidatedDouble = true;
    }
  }

  async invalidateAndAwait(): Promise<void> {
    if (this.stopped) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.pendings.push(resolve);
      this.invalidate();
    });
  }

  async awaitQueue(): Promise<void> {
    if (this.stopped || (!this.invalidated && this.pendings.length === 0)) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.pendings.push(resolve);
    });
  }

  stop(): void {
    if (this.stopped) {
      return;
    }
    this.notifyPendings();
    this.stopped = true;
  }

  private notifyPendings(): void {
    for (const pending of this.pendings) {
      pending();
    }
    this.pendings = [];
  }

  private async doSync(): Promise<void> {
    await backoff(async () => {
      if (this.stopped) {
        return;
      }
      await this.command();
    });

    if (this.stopped) {
      this.notifyPendings();
      return;
    }

    if (this.invalidatedDouble) {
      this.invalidatedDouble = false;
      await this.doSync();
    } else {
      this.invalidated = false;
      this.notifyPendings();
    }
  }
}

export class ValueSync<T> {
  private latestValue: T | undefined;
  private hasValue = false;
  private processing = false;
  private stopped = false;
  private command: (value: T) => Promise<void>;
  private pendings: Array<() => void> = [];

  constructor(command: (value: T) => Promise<void>) {
    this.command = command;
  }

  setValue(value: T): void {
    if (this.stopped) {
      return;
    }
    this.latestValue = value;
    this.hasValue = true;
    if (!this.processing) {
      this.processing = true;
      void this.doSync();
    }
  }

  async setValueAndAwait(value: T): Promise<void> {
    if (this.stopped) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.pendings.push(resolve);
      this.setValue(value);
    });
  }

  async awaitQueue(): Promise<void> {
    if (this.stopped || (!this.processing && this.pendings.length === 0)) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.pendings.push(resolve);
    });
  }

  stop(): void {
    if (this.stopped) {
      return;
    }
    this.notifyPendings();
    this.stopped = true;
  }

  private notifyPendings(): void {
    for (const pending of this.pendings) {
      pending();
    }
    this.pendings = [];
  }

  private async doSync(): Promise<void> {
    while (this.hasValue && !this.stopped) {
      const value = this.latestValue as T;
      this.hasValue = false;

      await backoff(async () => {
        if (this.stopped) {
          return;
        }
        await this.command(value);
      });

      if (this.stopped) {
        this.notifyPendings();
        return;
      }
    }

    this.processing = false;
    this.notifyPendings();
  }
}
