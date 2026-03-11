import { describe, expect, it } from "vitest";
import { MINI_APP_ICON_FALLBACK, miniAppIconResolve } from "./miniAppIconResolve";

describe("miniAppIconResolve", () => {
    it("keeps valid octicons", () => {
        expect(miniAppIconResolve("browser")).toBe("browser");
    });

    it("falls back for invalid octicons", () => {
        expect(miniAppIconResolve("not-a-real-icon")).toBe(MINI_APP_ICON_FALLBACK);
    });
});
