import { afterEach, describe, expect, it } from "vitest";

import { authDefaultsResolve } from "@/modules/auth/authDefaultsResolve";

describe("authDefaultsResolve", () => {
    const originalBackendUrl = process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL;
    const originalTelegramInstanceId = process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID;

    afterEach(() => {
        if (originalBackendUrl === undefined) {
            delete process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL;
        } else {
            process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL = originalBackendUrl;
        }

        if (originalTelegramInstanceId === undefined) {
            delete process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID;
        } else {
            process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID = originalTelegramInstanceId;
        }
    });

    it("returns built-in defaults when Expo config does not provide overrides", () => {
        delete process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL;
        delete process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID;

        expect(authDefaultsResolve()).toEqual({
            backendUrl: "https://api.daycare.dev",
            telegramInstanceId: "telegram"
        });
    });

    it("returns environment-configured overrides when they are valid", () => {
        process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL = "https://api.example.com/";
        process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID = "telegram-main";

        expect(authDefaultsResolve()).toEqual({
            backendUrl: "https://api.example.com",
            telegramInstanceId: "telegram-main"
        });
    });

    it("falls back when environment contains invalid override values", () => {
        process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL = "not-a-url";
        process.env.EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID = "   ";

        expect(authDefaultsResolve()).toEqual({
            backendUrl: "https://api.daycare.dev",
            telegramInstanceId: "telegram"
        });
    });
});
