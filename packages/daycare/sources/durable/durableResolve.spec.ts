import { describe, expect, it, vi } from "vitest";

import { DurableInngest } from "./durableInngest.js";
import { DurableLocal } from "./durableLocal.js";
import { durableResolve } from "./durableResolve.js";

describe("durableResolve", () => {
    it("returns local runtime outside server mode", () => {
        const result = durableResolve(
            {
                INNGEST_ENDPOINT: "wss://inngest.example/connect"
            },
            { server: false }
        );

        expect(result).toBeInstanceOf(DurableLocal);
        expect(result.kind).toBe("local");
    });

    it("returns local runtime in server mode when Inngest env is missing", () => {
        const result = durableResolve({}, { server: true });

        expect(result).toBeInstanceOf(DurableLocal);
        expect(result.kind).toBe("local");
    });

    it("returns Inngest runtime in server mode when configured", () => {
        const result = durableResolve(
            {
                INNGEST_ENDPOINT: "wss://inngest.example/connect"
            },
            { server: true }
        );

        expect(result).toBeInstanceOf(DurableInngest);
        expect(result.kind).toBe("inngest");
    });

    it("passes connect overrides to the Inngest runtime", async () => {
        const close = vi.fn(async () => undefined);
        const connectRun = vi.fn(async () => ({
            close,
            closed: Promise.resolve(),
            connectionId: "conn-1",
            state: "ACTIVE"
        }));
        const result = durableResolve(
            {
                INNGEST_ENDPOINT: "wss://inngest.example/connect"
            },
            { inngest: { connectRun: connectRun as never }, server: true }
        );

        await result.start();

        expect(connectRun).toHaveBeenCalledTimes(1);
    });
});
