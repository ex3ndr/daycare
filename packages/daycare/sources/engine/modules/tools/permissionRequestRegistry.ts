import type { PermissionDecision } from "@/types";

type PendingPermissionRequest = {
  resolve: (decision: PermissionDecision) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * Tracks pending permission requests so tool calls can wait for user decisions.
 * Expects: token values are unique per in-flight request.
 */
export class PermissionRequestRegistry {
  private pending = new Map<string, PendingPermissionRequest>();

  register(token: string, timeoutMs: number): Promise<PermissionDecision> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("Permission timeout must be greater than zero.");
    }
    if (this.pending.has(token)) {
      throw new Error("Permission token is already pending.");
    }

    return new Promise<PermissionDecision>((resolve, reject) => {
      const timer = setTimeout(() => {
        const entry = this.pendingTake(token);
        if (!entry) {
          return;
        }
        entry.reject(new Error("Permission request timed out."));
      }, timeoutMs);

      this.pending.set(token, { resolve, reject, timer });
    });
  }

  resolve(token: string, decision: PermissionDecision): boolean {
    const entry = this.pendingTake(token);
    if (!entry) {
      return false;
    }
    clearTimeout(entry.timer);
    entry.resolve(decision);
    return true;
  }

  cancel(token: string): void {
    const entry = this.pendingTake(token);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    entry.reject(new Error("Permission request cancelled."));
  }

  private pendingTake(token: string): PendingPermissionRequest | null {
    const entry = this.pending.get(token);
    if (!entry) {
      return null;
    }
    this.pending.delete(token);
    return entry;
  }
}
