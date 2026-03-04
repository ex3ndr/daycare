import { afterEach, describe, expect, it, vi } from "vitest";
import { agentsFetch } from "./agentsFetch";
import { agentsStoreCreate } from "./agentsStoreCreate";

vi.mock("./agentsFetch", () => ({
    agentsFetch: vi.fn()
}));

describe("agentsStoreCreate", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("fetch stores agent list on success", async () => {
        vi.mocked(agentsFetch).mockResolvedValueOnce([
            {
                agentId: "agent-1",
                name: "Primary",
                kind: "agent",
                lifecycle: "active",
                path: "/user-1/agent/primary",
                description: null,
                connectorName: null,
                foreground: true,
                createdAt: 1000,
                updatedAt: 1000
            }
        ]);

        const store = agentsStoreCreate();
        await store.getState().fetch("http://localhost", "tok");

        expect(agentsFetch).toHaveBeenCalledWith("http://localhost", "tok");
        expect(store.getState().agents).toEqual([
            {
                agentId: "agent-1",
                name: "Primary",
                kind: "agent",
                lifecycle: "active",
                path: "/user-1/agent/primary",
                description: null,
                connectorName: null,
                foreground: true,
                createdAt: 1000,
                updatedAt: 1000
            }
        ]);
        expect(store.getState().error).toBeNull();
    });

    it("fetch stores error on failure", async () => {
        vi.mocked(agentsFetch).mockRejectedValueOnce(new Error("network down"));

        const store = agentsStoreCreate();
        await store.getState().fetch("http://localhost", "tok");

        expect(store.getState().agents).toEqual([]);
        expect(store.getState().error).toBe("network down");
        expect(store.getState().loading).toBe(false);
    });
});
