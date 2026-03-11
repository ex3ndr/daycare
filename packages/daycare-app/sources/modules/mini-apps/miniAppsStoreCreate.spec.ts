import { describe, expect, it } from "vitest";
import { MINI_APPS_EMPTY, miniAppsStoreCreate } from "./miniAppsStoreCreate";

describe("miniAppsStoreCreate", () => {
    it("keeps the empty workspace array stable", () => {
        const store = miniAppsStoreCreate();

        const first = store.getState().appsByWorkspace.missing ?? MINI_APPS_EMPTY;
        const second = store.getState().appsByWorkspace.missing ?? MINI_APPS_EMPTY;

        expect(first).toBe(MINI_APPS_EMPTY);
        expect(second).toBe(MINI_APPS_EMPTY);
        expect(second).toBe(first);
    });
});
