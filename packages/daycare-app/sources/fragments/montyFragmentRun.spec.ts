import { beforeEach, describe, expect, it, vi } from "vitest";

const montyMockState = vi.hoisted(() => {
    class MockMontyRuntimeError extends Error {
        constructor(private readonly messageText: string) {
            super(messageText);
            this.name = "MontyRuntimeError";
        }

        display(format?: string): string {
            return format === "type-msg" ? `RuntimeError: ${this.messageText}` : this.messageText;
        }
    }

    class MockMontySyntaxError extends Error {
        constructor(private readonly messageText: string) {
            super(messageText);
            this.name = "MontySyntaxError";
        }

        display(format?: string): string {
            return format === "type-msg" ? `SyntaxError: ${this.messageText}` : this.messageText;
        }
    }

    return {
        constructorImpl: vi.fn(),
        runAsyncImpl: vi.fn(),
        loadImpl: vi.fn(async () => undefined),
        MockMontyRuntimeError,
        MockMontySyntaxError
    };
});

vi.mock("react-native-monty", () => {
    class MockMonty {
        constructor(code: string, options?: unknown) {
            montyMockState.constructorImpl(code, options);
        }
    }

    return {
        loadMonty: montyMockState.loadImpl,
        Monty: MockMonty,
        runMontyAsync: montyMockState.runAsyncImpl,
        MontyRuntimeError: montyMockState.MockMontyRuntimeError,
        MontySyntaxError: montyMockState.MockMontySyntaxError
    };
});

import { montyFragmentAction, montyFragmentInit } from "./montyFragmentRun.js";

describe("montyFragmentRun", () => {
    beforeEach(() => {
        montyMockState.constructorImpl.mockReset();
        montyMockState.runAsyncImpl.mockReset();
        montyMockState.loadImpl.mockClear();
    });

    it("runs init and returns object state", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue({ count: 2 });

        const result = await montyFragmentInit('def init():\n    return {"count": 2}');

        expect(result).toEqual({
            ok: true,
            value: { count: 2 }
        });
        expect(montyMockState.constructorImpl).toHaveBeenCalledOnce();
        expect(montyMockState.runAsyncImpl).toHaveBeenCalledOnce();
    });

    it("returns null when init is not defined", async () => {
        const result = await montyFragmentInit("def increment(params):\n    return params");

        expect(result).toBeNull();
        expect(montyMockState.constructorImpl).not.toHaveBeenCalled();
    });

    it("passes params and external functions into action execution", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue({ count: 4 });

        const externalFunctions = {
            get_state: vi.fn(() => ({ count: 3 }))
        };
        const result = await montyFragmentAction(
            'def increment(params):\n    return {"count": params["amount"]}',
            "increment",
            { amount: 4 },
            { externalFunctions }
        );

        expect(result).toEqual({
            ok: true,
            value: { count: 4 }
        });
        expect(montyMockState.runAsyncImpl).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                inputs: { params: { amount: 4 } },
                externalFunctions
            })
        );
    });

    it("supports async init functions", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue({ ready: true });

        const result = await montyFragmentInit('async def init():\n    return {"ready": True}');

        expect(result).toEqual({
            ok: true,
            value: { ready: true }
        });
    });

    it("normalizes Monty map results into plain objects", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue(new Map([["count", 5]]));

        const result = await montyFragmentInit('def init():\n    return {"count": 5}');

        expect(result).toEqual({
            ok: true,
            value: { count: 5 }
        });
    });

    it("formats runtime errors", async () => {
        montyMockState.runAsyncImpl.mockRejectedValue(new montyMockState.MockMontyRuntimeError("bad state"));

        const result = await montyFragmentAction("def crash(params):\n    raise RuntimeError()", "crash", {});

        expect(result).toEqual({
            ok: false,
            error: "RuntimeError: bad state"
        });
    });

    it("formats syntax errors", async () => {
        montyMockState.constructorImpl.mockImplementation(() => {
            throw new montyMockState.MockMontySyntaxError("invalid syntax");
        });

        const result = await montyFragmentInit("def init(");

        expect(result).toEqual({
            ok: false,
            error: "SyntaxError: invalid syntax"
        });
    });

    it("allows fragment functions to return null", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue(null);

        const result = await montyFragmentAction("def noop(params):\n    return None", "noop", {});

        expect(result).toEqual({
            ok: true,
            value: null
        });
    });
});
