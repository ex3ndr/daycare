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
        runImpl: vi.fn(),
        loadImpl: vi.fn(async () => undefined),
        MockMontyRuntimeError,
        MockMontySyntaxError
    };
});

vi.mock("react-native-monty", () => {
    class MockMonty {
        private readonly code: string;
        private readonly options: unknown;

        constructor(code: string, options?: unknown) {
            montyMockState.constructorImpl(code, options);
            this.code = code;
            this.options = options;
        }

        run(runOptions?: unknown): unknown {
            return montyMockState.runImpl(this.code, this.options, runOptions);
        }
    }

    return {
        loadMonty: montyMockState.loadImpl,
        Monty: MockMonty,
        MontyRuntimeError: montyMockState.MockMontyRuntimeError,
        MontySyntaxError: montyMockState.MockMontySyntaxError
    };
});

import { montyFragmentAction, montyFragmentInit } from "./montyFragmentRun.js";

describe("montyFragmentRun", () => {
    beforeEach(() => {
        montyMockState.constructorImpl.mockReset();
        montyMockState.runImpl.mockReset();
        montyMockState.loadImpl.mockClear();
    });

    it("runs init and returns object state", () => {
        montyMockState.runImpl.mockReturnValue({ count: 2 });

        const result = montyFragmentInit('def init():\n    return {"count": 2}');

        expect(result).toEqual({
            ok: true,
            value: { count: 2 }
        });
        expect(montyMockState.constructorImpl).toHaveBeenCalledOnce();
        expect(montyMockState.runImpl).toHaveBeenCalledOnce();
    });

    it("returns null when init is not defined", () => {
        const result = montyFragmentInit("def increment(state, params):\n    return state");

        expect(result).toBeNull();
        expect(montyMockState.constructorImpl).not.toHaveBeenCalled();
    });

    it("passes state and params into action execution", () => {
        montyMockState.runImpl.mockImplementation((_code, _options, runOptions) => {
            return {
                count:
                    ((runOptions as { inputs: { state: { count: number }; params: { amount: number } } }).inputs.state
                        .count ?? 0) +
                    (runOptions as { inputs: { state: { count: number }; params: { amount: number } } }).inputs.params
                        .amount
            };
        });

        const result = montyFragmentAction(
            'def increment(state, params):\n    return {"count": state["count"] + params["amount"]}',
            "increment",
            { count: 3 },
            { amount: 4 }
        );

        expect(result).toEqual({
            ok: true,
            value: { count: 7 }
        });
    });

    it("normalizes Monty map results into plain objects", () => {
        montyMockState.runImpl.mockReturnValue(new Map([["count", 5]]));

        const result = montyFragmentInit('def init():\n    return {"count": 5}');

        expect(result).toEqual({
            ok: true,
            value: { count: 5 }
        });
    });

    it("formats runtime errors", () => {
        montyMockState.runImpl.mockImplementation(() => {
            throw new montyMockState.MockMontyRuntimeError("bad state");
        });

        const result = montyFragmentAction("def crash(state, params):\n    raise RuntimeError()", "crash", {}, {});

        expect(result).toEqual({
            ok: false,
            error: "RuntimeError: bad state"
        });
    });

    it("formats syntax errors", () => {
        montyMockState.constructorImpl.mockImplementation(() => {
            throw new montyMockState.MockMontySyntaxError("invalid syntax");
        });

        const result = montyFragmentInit("def init(");

        expect(result).toEqual({
            ok: false,
            error: "SyntaxError: invalid syntax"
        });
    });
});
