import { describe, expect, it } from "vitest";
import { configRead } from "./configRead.js";

describe("configRead", () => {
    it("returns normalized config when user exists", async () => {
        const result = await configRead({
            ctx: { userId: "u1" },
            users: {
                findById: async () => ({
                    configuration: { homeReady: true, appReady: false }
                })
            }
        });
        expect(result).toEqual({
            ok: true,
            configuration: { homeReady: true, appReady: false }
        });
    });

    it("returns defaults when user not found", async () => {
        const result = await configRead({
            ctx: { userId: "missing" },
            users: { findById: async () => null }
        });
        expect(result).toEqual({
            ok: true,
            configuration: { homeReady: false, appReady: false }
        });
    });

    it("normalizes malformed configuration", async () => {
        const result = await configRead({
            ctx: { userId: "u1" },
            users: {
                findById: async () => ({
                    configuration: { homeReady: "yes", appReady: 1 } as unknown as {
                        homeReady: boolean;
                        appReady: boolean;
                    }
                })
            }
        });
        expect(result).toEqual({
            ok: true,
            configuration: { homeReady: false, appReady: false }
        });
    });
});
