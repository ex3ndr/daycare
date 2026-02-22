import { describe, expect, it, vi } from "vitest";

import { plugin } from "./plugin.js";

describe("telegram plugin settings schema", () => {
    it("allows public mode without allowedUids", () => {
        const parsed = plugin.settingsSchema.parse({
            mode: "public"
        }) as { mode: "public" | "private"; allowedUids: string[] };

        expect(parsed.mode).toBe("public");
        expect(parsed.allowedUids).toEqual([]);
    });

    it("requires at least one allowed UID in private mode", () => {
        const parsed = plugin.settingsSchema.safeParse({
            mode: "private"
        });

        expect(parsed.success).toBe(false);
        if (parsed.success) {
            return;
        }
        expect(parsed.error.issues[0]?.path).toEqual(["allowedUids"]);
        expect(parsed.error.issues[0]?.message).toBe("allowedUids must have at least 1 entry in private mode");
    });
});

describe("telegram plugin onboarding", () => {
    it("skips UID prompt in public mode", async () => {
        const input = vi.fn(async () => "token");
        const selectMock = vi.fn(async () => "public");
        const select: Parameters<NonNullable<typeof plugin.onboarding>>[0]["prompt"]["select"] = async <
            TValue extends string
        >() => (await selectMock()) as unknown as TValue | null;
        const setToken = vi.fn(async () => undefined);

        const result = await plugin.onboarding?.({
            instanceId: "telegram",
            pluginId: "telegram",
            dataDir: "/tmp/daycare",
            auth: { setToken } as never,
            prompt: {
                input,
                select,
                confirm: async () => null
            },
            note: vi.fn()
        });

        expect(result).toEqual({
            settings: { mode: "public" }
        });
        expect(input).toHaveBeenCalledTimes(1);
        expect(selectMock).toHaveBeenCalledTimes(1);
        expect(setToken).toHaveBeenCalledWith("telegram", "token");
    });

    it("prompts for UIDs in private mode", async () => {
        const input = vi.fn().mockResolvedValueOnce("token").mockResolvedValueOnce("123, 456,123");
        const selectMock = vi.fn(async () => "private");
        const select: Parameters<NonNullable<typeof plugin.onboarding>>[0]["prompt"]["select"] = async <
            TValue extends string
        >() => (await selectMock()) as unknown as TValue | null;
        const setToken = vi.fn(async () => undefined);

        const result = await plugin.onboarding?.({
            instanceId: "telegram",
            pluginId: "telegram",
            dataDir: "/tmp/daycare",
            auth: { setToken } as never,
            prompt: {
                input,
                select,
                confirm: async () => null
            },
            note: vi.fn()
        });

        expect(result).toEqual({
            settings: { mode: "private", allowedUids: ["123", "456"] }
        });
        expect(input).toHaveBeenCalledTimes(2);
        expect(selectMock).toHaveBeenCalledTimes(1);
        expect(setToken).toHaveBeenCalledWith("telegram", "token");
    });

    it("does not persist token when private UID prompt is canceled", async () => {
        const input = vi.fn().mockResolvedValueOnce("token").mockResolvedValueOnce(null);
        const selectMock = vi.fn(async () => "private");
        const select: Parameters<NonNullable<typeof plugin.onboarding>>[0]["prompt"]["select"] = async <
            TValue extends string
        >() => (await selectMock()) as unknown as TValue | null;
        const setToken = vi.fn(async () => undefined);

        const result = await plugin.onboarding?.({
            instanceId: "telegram",
            pluginId: "telegram",
            dataDir: "/tmp/daycare",
            auth: { setToken } as never,
            prompt: {
                input,
                select,
                confirm: async () => null
            },
            note: vi.fn()
        });

        expect(result).toBeNull();
        expect(setToken).not.toHaveBeenCalled();
    });
});
