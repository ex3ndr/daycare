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
        montyMockState.runAsyncImpl.mockResolvedValue({
            __fragment_result__: { count: 2 },
            __fragment_state__: { count: 0 },
            __fragment_state_dirty__: false
        });

        const result = await montyFragmentInit('def init():\n    return {"count": 2}', {
            state: { count: 0 }
        });

        expect(result).toEqual({
            ok: true,
            value: { count: 2 },
            state: { count: 0 },
            stateDirty: false
        });
        expect(montyMockState.constructorImpl).toHaveBeenCalledOnce();
        expect(montyMockState.constructorImpl).toHaveBeenCalledWith(
            expect.stringContaining("__fragment_initial_state"),
            expect.objectContaining({
                inputs: ["__fragment_initial_state"]
            })
        );
        expect(montyMockState.runAsyncImpl).toHaveBeenCalledOnce();
        expect(montyMockState.runAsyncImpl).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                inputs: {
                    __fragment_initial_state: { count: 0 }
                }
            })
        );
    });

    it("returns null when init is not defined", async () => {
        const result = await montyFragmentInit("def increment(params):\n    return params");

        expect(result).toBeNull();
        expect(montyMockState.constructorImpl).not.toHaveBeenCalled();
    });

    it("passes params and external functions into action execution", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue({
            __fragment_result__: { count: 4 },
            __fragment_state__: { count: 3 },
            __fragment_state_dirty__: false
        });

        const externalFunctions = {
            get_state: vi.fn(() => ({ count: 3 }))
        };
        const result = await montyFragmentAction(
            'def increment(params):\n    return {"count": params["amount"]}',
            "increment",
            { amount: 4 },
            { externalFunctions, state: { count: 3 } }
        );

        expect(result).toEqual({
            ok: true,
            value: { count: 4 },
            state: { count: 3 },
            stateDirty: false
        });
        expect(montyMockState.runAsyncImpl).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                inputs: {
                    __fragment_initial_state: { count: 3 },
                    params: { amount: 4 }
                },
                externalFunctions
            })
        );
    });

    it("supports async init functions", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue({
            __fragment_result__: { ready: true },
            __fragment_state__: {},
            __fragment_state_dirty__: false
        });

        const result = await montyFragmentInit('async def init():\n    return {"ready": True}');

        expect(result).toEqual({
            ok: true,
            value: { ready: true },
            state: {},
            stateDirty: false
        });
    });

    it("normalizes Monty map results into plain objects", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue(
            new Map<string, unknown>([
                ["__fragment_result__", new Map([["count", 5]])],
                ["__fragment_state__", new Map()],
                ["__fragment_state_dirty__", false]
            ])
        );

        const result = await montyFragmentInit('def init():\n    return {"count": 5}');

        expect(result).toEqual({
            ok: true,
            value: { count: 5 },
            state: {},
            stateDirty: false
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
        montyMockState.runAsyncImpl.mockResolvedValue({
            __fragment_result__: null,
            __fragment_state__: {},
            __fragment_state_dirty__: false
        });

        const result = await montyFragmentAction("def noop(params):\n    return None", "noop", {});

        expect(result).toEqual({
            ok: true,
            value: null,
            state: {},
            stateDirty: false
        });
    });

    it("returns updated fragment state when apply mutates local state", async () => {
        montyMockState.runAsyncImpl.mockResolvedValue({
            __fragment_result__: null,
            __fragment_state__: { count: 2 },
            __fragment_state_dirty__: true
        });

        const result = await montyFragmentInit('def init():\n    apply({"count": 2})', {
            state: { count: 0 }
        });

        expect(result).toEqual({
            ok: true,
            value: null,
            state: { count: 2 },
            stateDirty: true
        });
    });
});
