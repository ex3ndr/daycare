import { describe, expect, it } from "vitest";
import { EngineEventBus } from "../../ipc/events.js";
import { agentEventEmit } from "./agentEventEmit.js";

describe("agentEventEmit", () => {
    it("emits agent.sync.created with userId and payload", () => {
        const eventBus = new EngineEventBus();
        const received: unknown[] = [];
        eventBus.onEvent((event) => received.push(event));

        agentEventEmit(eventBus, "user-1", "agent.sync.created", {
            agentId: "a1",
            kind: "app",
            name: "Test",
            lifecycle: "active",
            createdAt: 1000,
            updatedAt: 1000
        });

        expect(received).toHaveLength(1);
        const event = received[0] as Record<string, unknown>;
        expect(event.type).toBe("agent.sync.created");
        expect(event.userId).toBe("user-1");
        expect(event.payload).toEqual({
            agentId: "a1",
            kind: "app",
            name: "Test",
            lifecycle: "active",
            createdAt: 1000,
            updatedAt: 1000
        });
        expect(event.timestamp).toBeDefined();
    });

    it("emits agent.sync.updated with partial payload", () => {
        const eventBus = new EngineEventBus();
        const received: unknown[] = [];
        eventBus.onEvent((event) => received.push(event));

        agentEventEmit(eventBus, "user-2", "agent.sync.updated", {
            agentId: "a2",
            lifecycle: "sleeping",
            updatedAt: 2000
        });

        expect(received).toHaveLength(1);
        const event = received[0] as Record<string, unknown>;
        expect(event.type).toBe("agent.sync.updated");
        expect(event.userId).toBe("user-2");
        expect(event.payload).toEqual({
            agentId: "a2",
            lifecycle: "sleeping",
            updatedAt: 2000
        });
    });

    it("emits agent.sync.deleted with agentId only", () => {
        const eventBus = new EngineEventBus();
        const received: unknown[] = [];
        eventBus.onEvent((event) => received.push(event));

        agentEventEmit(eventBus, "user-3", "agent.sync.deleted", {
            agentId: "a3"
        });

        expect(received).toHaveLength(1);
        const event = received[0] as Record<string, unknown>;
        expect(event.type).toBe("agent.sync.deleted");
        expect(event.userId).toBe("user-3");
        expect(event.payload).toEqual({ agentId: "a3" });
    });
});
