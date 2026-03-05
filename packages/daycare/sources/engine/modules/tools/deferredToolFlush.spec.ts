import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext } from "@/types";
import { deferredToolFlush, deferredToolStatusBuild } from "./deferredToolFlush.js";

describe("deferredToolFlush", () => {
    it("flushes all entries and returns sent count", async () => {
        const handler = vi.fn(async () => {});
        const entries = [
            { toolName: "say", payload: { text: "a" }, handler },
            { toolName: "say", payload: { text: "b" }, handler }
        ];

        const result = await deferredToolFlush(entries, {} as ToolExecutionContext);

        expect(result).toEqual({ sent: 2, failed: 0 });
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith({ text: "a" }, expect.anything());
        expect(handler).toHaveBeenCalledWith({ text: "b" }, expect.anything());
    });

    it("returns zero counts for empty entries", async () => {
        const result = await deferredToolFlush([], {} as ToolExecutionContext);

        expect(result).toEqual({ sent: 0, failed: 0 });
    });

    it("counts failures independently and continues flushing", async () => {
        const succeedHandler = vi.fn(async () => {});
        const failHandler = vi.fn(async () => {
            throw new Error("send failed");
        });
        const entries = [
            { toolName: "say", payload: { text: "a" }, handler: succeedHandler },
            { toolName: "send_file", payload: { path: "/x" }, handler: failHandler },
            { toolName: "say", payload: { text: "c" }, handler: succeedHandler }
        ];

        const result = await deferredToolFlush(entries, {} as ToolExecutionContext);

        expect(result).toEqual({ sent: 2, failed: 1 });
        expect(succeedHandler).toHaveBeenCalledTimes(2);
        expect(failHandler).toHaveBeenCalledTimes(1);
    });

    it("passes context to each handler", async () => {
        const handler = vi.fn(async () => {});
        const context = { marker: "test-ctx" } as unknown as ToolExecutionContext;
        const entries = [{ toolName: "say", payload: {}, handler }];

        await deferredToolFlush(entries, context);

        expect(handler).toHaveBeenCalledWith({}, context);
    });
});

describe("deferredToolStatusBuild", () => {
    it("returns empty string when count is zero", () => {
        expect(deferredToolStatusBuild(null, 0)).toBe("");
        expect(deferredToolStatusBuild({ sent: 0, failed: 0 }, 0)).toBe("");
    });

    it("returns sent status on success", () => {
        expect(deferredToolStatusBuild({ sent: 3, failed: 0 }, 3)).toBe("\n\n[Deferred messages: 3 sent]");
    });

    it("returns sent and failed status on partial failure", () => {
        expect(deferredToolStatusBuild({ sent: 2, failed: 1 }, 3)).toBe("\n\n[Deferred messages: 2 sent, 1 failed]");
    });

    it("returns NOT sent status when result is null (script failed)", () => {
        expect(deferredToolStatusBuild(null, 2)).toBe("\n\n[Deferred messages: 2 NOT sent (script failed)]");
    });
});
