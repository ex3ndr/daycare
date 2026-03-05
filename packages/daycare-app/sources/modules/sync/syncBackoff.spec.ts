import { describe, expect, it } from "vitest";
import { BACKOFF_INITIAL_MS, BACKOFF_MAX_MS, syncBackoffCompute } from "./syncBackoff";

describe("syncBackoffCompute", () => {
    it("returns delay >= current backoff (includes jitter)", () => {
        const [delay] = syncBackoffCompute(1000);
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(1200); // max 20% jitter
    });

    it("doubles backoff on each call", () => {
        const [, next1] = syncBackoffCompute(BACKOFF_INITIAL_MS);
        expect(next1).toBe(2000);

        const [, next2] = syncBackoffCompute(next1);
        expect(next2).toBe(4000);

        const [, next3] = syncBackoffCompute(next2);
        expect(next3).toBe(8000);
    });

    it("caps backoff at max", () => {
        const [, next] = syncBackoffCompute(20_000);
        expect(next).toBe(BACKOFF_MAX_MS);

        const [, nextAgain] = syncBackoffCompute(BACKOFF_MAX_MS);
        expect(nextAgain).toBe(BACKOFF_MAX_MS);
    });

    it("initial backoff is 1000ms", () => {
        expect(BACKOFF_INITIAL_MS).toBe(1000);
    });

    it("max backoff is 30000ms", () => {
        expect(BACKOFF_MAX_MS).toBe(30_000);
    });
});
