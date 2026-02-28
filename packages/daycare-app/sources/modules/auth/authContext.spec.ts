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
            storage,
            validateToken: vi.fn(async () => ({ ok: true, userId: "user-1" }))
        });

        expect(store.getState().state).toBe("unauthenticated");

        await store.getState().login("http://localhost:7332", "jwt-token");
        expect(store.getState().state).toBe("authenticated");
        expect(store.getState().baseUrl).toBe("http://localhost:7332");
        expect(store.getState().token).toBe("jwt-token");
        expect(store.getState().userId).toBe("user-1");

        await store.getState().logout();
        expect(store.getState().state).toBe("unauthenticated");
        expect(store.getState().baseUrl).toBeNull();
        expect(store.getState().token).toBeNull();
        expect(store.getState().userId).toBeNull();
    });

    it("restores persisted session on bootstrap", async () => {
        const storage = {
            read: vi.fn(async () => ({ baseUrl: "http://localhost:7332", token: "stored-token" })),
            write: vi.fn(async () => undefined),
            clear: vi.fn(async () => undefined)
        };

        const store = authStoreCreate({
            storage,
            validateToken: vi.fn(async () => ({ ok: true, userId: "user-2" }))
        });

        await store.getState().bootstrap();

        expect(store.getState().ready).toBe(true);
        expect(store.getState().state).toBe("authenticated");
        expect(store.getState().baseUrl).toBe("http://localhost:7332");
        expect(store.getState().token).toBe("stored-token");
        expect(store.getState().userId).toBe("user-2");
    });

    it("prefers resolved session on bootstrap", async () => {
        const storage = {
            read: vi.fn(async () => ({ baseUrl: "http://localhost:7332", token: "stored-token" })),
            write: vi.fn(async () => undefined),
            clear: vi.fn(async () => undefined)
        };

        const store = authStoreCreate({
            storage,
            validateToken: vi.fn(async () => ({ ok: true, userId: "user-3" })),
            sessionResolve: vi.fn(async () => ({ baseUrl: "http://localhost:7444", token: "telegram-token" }))
        });

        await store.getState().bootstrap();

        expect(store.getState().ready).toBe(true);
        expect(store.getState().state).toBe("authenticated");
        expect(store.getState().baseUrl).toBe("http://localhost:7444");
        expect(store.getState().token).toBe("telegram-token");
        expect(store.getState().userId).toBe("user-3");
        expect(storage.write).toHaveBeenCalledWith({
            baseUrl: "http://localhost:7444",
            token: "telegram-token"
        });
        expect(storage.read).not.toHaveBeenCalled();
    });

    it("stores replacement token returned by validateToken", async () => {
        const storage = {
            read: vi.fn(async () => null),
            write: vi.fn(async () => undefined),
            clear: vi.fn(async () => undefined)
        };

        const store = authStoreCreate({
            storage,
            validateToken: vi.fn(async () => ({ ok: true, userId: "user-4", token: "session-token" }))
        });

        await store.getState().login("http://localhost:7332", "ephemeral-token");

        expect(store.getState().token).toBe("session-token");
        expect(storage.write).toHaveBeenCalledWith({
            baseUrl: "http://localhost:7332",
            token: "session-token"
        });
    });
});
