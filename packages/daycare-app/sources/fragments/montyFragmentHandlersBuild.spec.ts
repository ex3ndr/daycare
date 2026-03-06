import { beforeEach, describe, expect, it, vi } from "vitest";
import { montyFragmentHandlersBuild } from "./montyFragmentHandlersBuild.js";

describe("montyFragmentHandlersBuild", () => {
    const executeAction = vi.fn();

    beforeEach(() => {
        executeAction.mockReset();
    });

    it("executes an action via the supplied executor", () => {
        executeAction.mockReturnValue("ok");

        const handlers = montyFragmentHandlersBuild(executeAction);
        const result = handlers.increment({ amount: 3 });

        expect("increment" in handlers).toBe(true);
        expect(result).toBe("ok");
        expect(executeAction).toHaveBeenCalledWith("increment", { amount: 3 });
    });

    it("reuses the same handler instance for repeated access", () => {
        const handlers = montyFragmentHandlersBuild(executeAction);

        expect(handlers.increment).toBe(handlers.increment);
    });

    it("normalizes missing params to an empty object", () => {
        const handlers = montyFragmentHandlersBuild(executeAction);
        handlers.increment(undefined as never);

        expect(executeAction).toHaveBeenCalledWith("increment", {});
    });
});
