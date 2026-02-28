import { afterEach, describe, expect, it, vi } from "vitest";
import { authTelegramSessionResolve } from "@/modules/auth/authTelegramSessionResolve";

describe("authTelegramSessionResolve", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns null when window is unavailable", async () => {
        await expect(authTelegramSessionResolve()).resolves.toBeNull();
    });

    it("returns null when Telegram context is not present", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("window", {
            location: {
                search: "?foo=bar"
            },
            Telegram: {
                WebApp: {
                    initData: "init-data"
                }
            }
        } as unknown as Window);

        await expect(authTelegramSessionResolve()).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns session and calls Telegram ready when auth exchange succeeds", async () => {
        const ready = vi.fn();
        vi.stubGlobal("window", {
            location: {
                search: "?backend=https%3A%2F%2Fapi.example.com%2F&telegramInstanceId=telegram-main"
            },
            Telegram: {
                WebApp: {
                    initData: "init-data",
                    ready
                }
            }
        } as unknown as Window);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "123", token: "jwt-1" })
            }))
        );

        await expect(authTelegramSessionResolve()).resolves.toEqual({
            baseUrl: "https://api.example.com",
            token: "jwt-1"
        });
        expect(ready).toHaveBeenCalledTimes(1);
    });

    it("returns null when auth exchange fails", async () => {
        vi.stubGlobal("window", {
            location: {
                search: "?backend=https%3A%2F%2Fapi.example.com"
            },
            Telegram: {
                WebApp: {
                    initData: "init-data"
                }
            }
        } as unknown as Window);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "invalid initData" })
            }))
        );

        await expect(authTelegramSessionResolve()).resolves.toBeNull();
    });
});
