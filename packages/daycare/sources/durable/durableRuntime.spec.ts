import { afterEach, describe, expect, it, vi } from "vitest";

import type { DurableConfig } from "./durableConfigResolve.js";
import { DurableRuntime } from "./durableRuntime.js";

describe("DurableRuntime", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does nothing when durable config is absent", async () => {
        const connectRun = vi.fn();
        const runtime = new DurableRuntime(null, { connectRun: connectRun as never });

        await runtime.start();

        expect(connectRun).not.toHaveBeenCalled();
    });

    it("calls Inngest connect when durable config is present", async () => {
        const close = vi.fn(async () => undefined);
        const connection = {
            close,
            closed: Promise.resolve(),
            connectionId: "conn-1",
            state: "ACTIVE"
        };
        let capturedOptions: unknown;
        const connectRun = vi.fn(async (options: unknown) => {
            capturedOptions = options;
            return connection;
        });
        const runtime = new DurableRuntime(durableConfig(), { connectRun: connectRun as never });

        await runtime.start();

        expect(connectRun).toHaveBeenCalledTimes(1);
        expect(capturedOptions).toMatchObject({
            apps: [expect.objectContaining({ functions: [] })],
            gatewayUrl: "wss://inngest.example/connect"
        });
    });

    it("closes the active Inngest connection on stop", async () => {
        const close = vi.fn(async () => undefined);
        const connection = {
            close,
            closed: Promise.resolve(),
            connectionId: "conn-1",
            state: "ACTIVE"
        };
        const runtime = new DurableRuntime(durableConfig(), {
            connectRun: (async () => connection) as never
        });

        await runtime.start();
        await runtime.stop();

        expect(close).toHaveBeenCalledTimes(1);
    });

    it("starts only once", async () => {
        const connectRun = vi.fn(async () => ({
            close: async () => undefined,
            closed: Promise.resolve(),
            connectionId: "conn-1",
            state: "ACTIVE"
        }));
        const runtime = new DurableRuntime(durableConfig(), { connectRun: connectRun as never });

        await runtime.start();
        await runtime.start();

        expect(connectRun).toHaveBeenCalledTimes(1);
    });
});

function durableConfig(): DurableConfig {
    return {
        endpoint: "https://inngest.example/connect",
        token: "secret",
        apiUrl: "https://inngest.example/connect",
        gatewayUrl: "wss://inngest.example/connect"
    };
}
