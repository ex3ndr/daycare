import { afterEach, describe, expect, it, vi } from "vitest";
import { agentsFetch } from "./agentsFetch";
import { agentsStoreCreate } from "./agentsStoreCreate";
import type { AgentListItem } from "./agentsTypes";

vi.mock("./agentsFetch", () => ({
    agentsFetch: vi.fn()
}));

function agentCreate(overrides: Partial<AgentListItem> & { agentId: string }): AgentListItem {
    return {
        path: null,
        kind: "agent",
        name: null,
        description: null,
        connectorName: null,
        foreground: false,
        lifecycle: "active",
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides
    };
}

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

    describe("applyCreated", () => {
        it("adds a new agent to the front of the list", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1" })] });

            store.getState().applyCreated(agentCreate({ agentId: "a2", name: "New" }));

            const agents = store.getState().agents;
            expect(agents).toHaveLength(2);
            expect(agents[0].agentId).toBe("a2");
            expect(agents[1].agentId).toBe("a1");
        });

        it("skips duplicate agent by agentId", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1", name: "Original" })] });

            store.getState().applyCreated(agentCreate({ agentId: "a1", name: "Duplicate" }));

            const agents = store.getState().agents;
            expect(agents).toHaveLength(1);
            expect(agents[0].name).toBe("Original");
        });
    });

    describe("applyUpdated", () => {
        it("merges updated fields into existing agent", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1", lifecycle: "active", updatedAt: 1000 })] });

            store.getState().applyUpdated({ agentId: "a1", lifecycle: "sleeping", updatedAt: 2000 });

            const agent = store.getState().agents[0];
            expect(agent.lifecycle).toBe("sleeping");
            expect(agent.updatedAt).toBe(2000);
        });

        it("skips stale events (updatedAt <= current)", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1", lifecycle: "active", updatedAt: 2000 })] });

            store.getState().applyUpdated({ agentId: "a1", lifecycle: "sleeping", updatedAt: 1000 });

            expect(store.getState().agents[0].lifecycle).toBe("active");
        });

        it("skips equal updatedAt events", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1", name: "Original", updatedAt: 1000 })] });

            store.getState().applyUpdated({ agentId: "a1", name: "Changed", updatedAt: 1000 });

            expect(store.getState().agents[0].name).toBe("Original");
        });

        it("no-ops for unknown agent", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1" })] });

            store.getState().applyUpdated({ agentId: "unknown", lifecycle: "dead", updatedAt: 2000 });

            expect(store.getState().agents).toHaveLength(1);
        });
    });

    describe("applyDeleted", () => {
        it("removes agent from list", () => {
            const store = agentsStoreCreate();
            store.setState({
                agents: [agentCreate({ agentId: "a1" }), agentCreate({ agentId: "a2" })]
            });

            store.getState().applyDeleted("a1");

            const agents = store.getState().agents;
            expect(agents).toHaveLength(1);
            expect(agents[0].agentId).toBe("a2");
        });

        it("no-ops for missing agent", () => {
            const store = agentsStoreCreate();
            store.setState({ agents: [agentCreate({ agentId: "a1" })] });

            store.getState().applyDeleted("unknown");

            expect(store.getState().agents).toHaveLength(1);
        });
    });
});
