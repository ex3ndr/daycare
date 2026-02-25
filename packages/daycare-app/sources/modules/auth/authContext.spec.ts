import { describe, expect, it, vi } from "vitest";
import { authStoreCreate } from "@/modules/auth/authStoreCreate";

describe("authStoreCreate", () => {
    it("transitions unauthenticated -> authenticated -> logout", async () => {
        const storage = {
            read: vi.fn(async () => null),
            write: vi.fn(async () => undefined),
            clear: vi.fn(async () => undefined)
        };

        const store = authStoreCreate({
            baseUrl: "http://localhost:7332",
            storage,
            validateToken: vi.fn(async () => ({ ok: true, userId: "user-1" }))
        });

        expect(store.getState().state).toBe("unauthenticated");

        await store.getState().login("jwt-token");
        expect(store.getState().state).toBe("authenticated");
        expect(store.getState().token).toBe("jwt-token");
        expect(store.getState().userId).toBe("user-1");

        await store.getState().logout();
        expect(store.getState().state).toBe("unauthenticated");
        expect(store.getState().token).toBeNull();
        expect(store.getState().userId).toBeNull();
    });

    it("restores persisted token on bootstrap", async () => {
        const storage = {
            read: vi.fn(async () => "stored-token"),
            write: vi.fn(async () => undefined),
            clear: vi.fn(async () => undefined)
        };

        const store = authStoreCreate({
            baseUrl: "http://localhost:7332",
            storage,
            validateToken: vi.fn(async () => ({ ok: true, userId: "user-2" }))
        });

        await store.getState().bootstrap();

        expect(store.getState().ready).toBe(true);
        expect(store.getState().state).toBe("authenticated");
        expect(store.getState().token).toBe("stored-token");
        expect(store.getState().userId).toBe("user-2");
    });
});
