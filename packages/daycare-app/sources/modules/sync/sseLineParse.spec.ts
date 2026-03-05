import { describe, expect, it } from "vitest";
import { sseBufferParse, sseLineParse } from "./sseLineParse";

describe("sseLineParse", () => {
    it("parses data line with space", () => {
        expect(sseLineParse('data: {"type":"connected"}')).toBe('{"type":"connected"}');
    });

    it("parses data line without space", () => {
        expect(sseLineParse('data:{"type":"connected"}')).toBe('{"type":"connected"}');
    });

    it("returns null for comment lines", () => {
        expect(sseLineParse(":keepalive")).toBeNull();
    });

    it("returns null for empty lines", () => {
        expect(sseLineParse("")).toBeNull();
    });

    it("returns null for event field lines", () => {
        expect(sseLineParse("event: message")).toBeNull();
    });
});

describe("sseBufferParse", () => {
    it("parses complete SSE blocks", () => {
        const buffer = 'data: {"type":"connected"}\n\ndata: {"type":"agent.sync.created"}\n\n';
        const [results, remaining] = sseBufferParse(buffer);
        expect(results).toEqual(['{"type":"connected"}', '{"type":"agent.sync.created"}']);
        expect(remaining).toBe("");
    });

    it("returns incomplete data as remaining buffer", () => {
        const buffer = 'data: {"type":"connected"}\n\ndata: {"type":"ag';
        const [results, remaining] = sseBufferParse(buffer);
        expect(results).toEqual(['{"type":"connected"}']);
        expect(remaining).toBe('data: {"type":"ag');
    });

    it("skips keepalive comments", () => {
        const buffer = ':keepalive\n\ndata: {"type":"connected"}\n\n';
        const [results, remaining] = sseBufferParse(buffer);
        expect(results).toEqual(['{"type":"connected"}']);
        expect(remaining).toBe("");
    });

    it("handles empty buffer", () => {
        const [results, remaining] = sseBufferParse("");
        expect(results).toEqual([]);
        expect(remaining).toBe("");
    });

    it("handles buffer with only incomplete block", () => {
        const [results, remaining] = sseBufferParse("data: partial");
        expect(results).toEqual([]);
        expect(remaining).toBe("data: partial");
    });
});
