import { afterEach, describe, expect, it, vi } from "vitest";
import { authTelegramSessionResolve } from "@/modules/auth/authTelegramSessionResolve";
import { isTMA } from "@/modules/tma/isTMA";
import { tmaInitData } from "@/modules/tma/tmaInitData";
import { tmaLaunchParams } from "@/modules/tma/tmaLaunchParams";
import { tmaReady } from "@/modules/tma/tmaReady";

vi.mock("@/modules/tma/isTMA", () => ({
    isTMA: vi.fn(() => false)
}));

vi.mock("@/modules/tma/tmaInitData", () => ({
    tmaInitData: vi.fn(() => undefined)
}));

vi.mock("@/modules/tma/tmaLaunchParams", () => ({
    tmaLaunchParams: vi.fn(() => undefined)
}));

vi.mock("@/modules/tma/tmaReady", () => ({
    tmaReady: vi.fn()
}));

describe("authTelegramSessionResolve", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.mocked(isTMA).mockReturnValue(false);
        vi.mocked(tmaInitData).mockReturnValue(undefined);
        vi.mocked(tmaLaunchParams).mockReturnValue(undefined);
        vi.mocked(tmaReady).mockReset();
    });

    it("returns null when window is unavailable", async () => {
        await expect(authTelegramSessionResolve()).resolves.toBeNull();
    });

    it("returns null when not in TMA environment", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("window", {
            location: { href: "https://app.test?backend=https%3A%2F%2Fapi.example.com" }
        } as unknown as Window);
        vi.mocked(isTMA).mockReturnValue(false);

        await expect(authTelegramSessionResolve()).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null when initData is not available", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("window", {
            location: { href: "https://app.test?backend=https%3A%2F%2Fapi.example.com" }
        } as unknown as Window);
        vi.mocked(isTMA).mockReturnValue(true);
        vi.mocked(tmaInitData).mockReturnValue(undefined);

        await expect(authTelegramSessionResolve()).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses default backend and telegram instance id when launch params omit both", async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => ({ ok: true, userId: "default-user", token: "jwt-default" })
        }));
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("window", {
            location: { href: "https://app.test?foo=bar" }
        } as unknown as Window);
        vi.mocked(isTMA).mockReturnValue(true);
        vi.mocked(tmaInitData).mockReturnValue("init-data");

        await expect(authTelegramSessionResolve()).resolves.toEqual({
            baseUrl: "https://api.daycare.dev",
            token: "jwt-default"
        });
        expect(fetchMock).toHaveBeenCalledWith("https://api.daycare.dev/auth/telegram", {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                initData: "init-data",
                telegramInstanceId: "telegram"
            })
        });
    });

    it("returns session and calls tmaReady when auth exchange succeeds", async () => {
        const fetchMock = vi.fn(async () => ({
            json: async () => ({ ok: true, userId: "123", token: "jwt-1" })
        }));
        vi.stubGlobal("window", {
            location: {
                href: "https://app.test?backend=https%3A%2F%2Fapi.example.com%2F&telegramInstanceId=telegram-main"
            }
        } as unknown as Window);
        vi.stubGlobal("fetch", fetchMock);
        vi.mocked(isTMA).mockReturnValue(true);
        vi.mocked(tmaInitData).mockReturnValue("init-data");

        await expect(authTelegramSessionResolve()).resolves.toEqual({
            baseUrl: "https://api.example.com",
            token: "jwt-1"
        });
        expect(tmaReady).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/auth/telegram", {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                initData: "init-data",
                telegramInstanceId: "telegram-main"
            })
        });
    });

    it("resolves session from launch params when href has no backend", async () => {
        vi.stubGlobal("window", {
            location: { href: "https://app.test/" }
        } as unknown as Window);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: true, userId: "456", token: "jwt-lp" })
            }))
        );
        vi.mocked(isTMA).mockReturnValue(true);
        vi.mocked(tmaInitData).mockReturnValue("init-data");
        vi.mocked(tmaLaunchParams).mockReturnValue(
            "backend=https%3A%2F%2Fapi.example.com&telegramInstanceId=tg-1&tgWebAppData=foo"
        );

        await expect(authTelegramSessionResolve()).resolves.toEqual({
            baseUrl: "https://api.example.com",
            token: "jwt-lp"
        });
        expect(tmaReady).toHaveBeenCalledTimes(1);
    });

    it("returns null when auth exchange fails", async () => {
        vi.stubGlobal("window", {
            location: { href: "https://app.test?backend=https%3A%2F%2Fapi.example.com" }
        } as unknown as Window);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({ ok: false, error: "invalid initData" })
            }))
        );
        vi.mocked(isTMA).mockReturnValue(true);
        vi.mocked(tmaInitData).mockReturnValue("init-data");

        await expect(authTelegramSessionResolve()).resolves.toBeNull();
    });
});
