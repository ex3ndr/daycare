import { createStateStore } from "@json-render/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
    montyFragmentAction: vi.fn()
}));

vi.mock("./montyFragmentRun.js", () => ({
    montyFragmentAction: mockState.montyFragmentAction
}));

import { montyFragmentHandlersBuild } from "./montyFragmentHandlersBuild.js";

describe("montyFragmentHandlersBuild", () => {
    beforeEach(() => {
        mockState.montyFragmentAction.mockReset();
    });

    it("executes an action and updates store state", () => {
        const store = createStateStore({ count: 1 });
        mockState.montyFragmentAction.mockReturnValue({
            ok: true,
            value: { count: 4 }
        });

        const handlers = montyFragmentHandlersBuild("code", store);
        handlers.increment({ amount: 3 });

        expect("increment" in handlers).toBe(true);
        expect(mockState.montyFragmentAction).toHaveBeenCalledWith("code", "increment", { count: 1 }, { amount: 3 });
        expect(store.getSnapshot()).toEqual({ count: 4 });
    });

    it("applies sequential action results against the latest snapshot", () => {
        const store = createStateStore({ count: 0 });
        mockState.montyFragmentAction.mockImplementation((_code, _action, state) => {
            return {
                ok: true,
                value: { count: (state as { count: number }).count + 1 }
            };
        });

        const handlers = montyFragmentHandlersBuild("code", store);
        handlers.increment({});
        handlers.increment({});

        expect(store.getSnapshot()).toEqual({ count: 2 });
    });

    it("logs Python errors instead of throwing", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const store = createStateStore({ count: 1 });
        mockState.montyFragmentAction.mockReturnValue({
            ok: false,
            error: "RuntimeError: boom"
        });

        const handlers = montyFragmentHandlersBuild("code", store);

        expect(() => handlers.increment({})).not.toThrow();
        expect(warn).toHaveBeenCalledWith("[daycare-app] fragment-python action=increment error=RuntimeError: boom");
        expect(store.getSnapshot()).toEqual({ count: 1 });

        warn.mockRestore();
    });
});
