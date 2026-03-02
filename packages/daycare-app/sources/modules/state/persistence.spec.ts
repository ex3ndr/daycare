import { afterEach, describe, expect, it, vi } from "vitest";
import { loadThemePreference } from "@/modules/state/persistence";

describe("loadThemePreference", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns adaptive when window is unavailable", () => {
        expect(loadThemePreference()).toBe("adaptive");
    });

    it("returns adaptive when localStorage is unavailable", () => {
        vi.stubGlobal("window", {} as unknown as Window);

        expect(loadThemePreference()).toBe("adaptive");
    });

    it("returns stored value when localStorage contains a valid preference", () => {
        vi.stubGlobal("window", {
            localStorage: {
                getItem: vi.fn(() => "dark")
            }
        } as unknown as Window);

        expect(loadThemePreference()).toBe("dark");
    });

    it("returns adaptive when localStorage throws", () => {
        vi.stubGlobal("window", {
            localStorage: {
                getItem: vi.fn(() => {
                    throw new Error("storage blocked");
                })
            }
        } as unknown as Window);

        expect(loadThemePreference()).toBe("adaptive");
    });
});
