import { describe, expect, it } from "vitest";

import {
    Context,
    contextForAgent,
    contextForUser,
    contextSerialize,
    contexts,
    contextToJSON,
    createContextNamespace,
    emptyContext
} from "./context.js";

describe("Context", () => {
    it("builds a user-only context", () => {
        const context = contextForUser({ userId: "user-1" });
        expect(context.userId).toBe("user-1");
        expect(context.personUserId).toBeUndefined();
        expect(context.hasAgentId).toBe(false);
    });

    it("builds an agent context", () => {
        const context = contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" });
        expect(context.userId).toBe("user-1");
        expect(context.personUserId).toBe("person-1");
        expect(context.agentId).toBe("agent-1");
        expect(context.hasAgentId).toBe(true);
    });

    it("throws when agentId is read from user-only context", () => {
        const context = contextForUser({ userId: "user-1" });
        expect(() => context.agentId).toThrow("Context has no agentId");
    });

    it("is readonly", () => {
        const context = contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" });
        const readonlyAssertion = (value: Context): void => {
            // @ts-expect-error Context fields are readonly
            value.agentId = "agent-2";
            // @ts-expect-error Context fields are readonly
            value.userId = "user-2";
            // @ts-expect-error Context fields are readonly
            value.personUserId = "person-2";
        };
        void readonlyAssertion;
        expect(context.agentId).toBe("agent-1");
        expect(context.userId).toBe("user-1");
        expect(context.personUserId).toBe("person-1");
    });

    it("serializes and restores durable state", () => {
        const context = contexts.durable.set(
            contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" }),
            {
                active: true,
                kind: "local"
            }
        );

        const restored = Context.fromJSON(contextToJSON(context));
        expect(restored.userId).toBe("user-1");
        expect(restored.personUserId).toBe("person-1");
        expect(restored.agentId).toBe("agent-1");
        expect(restored.durable).toEqual({
            active: true,
            kind: "local"
        });
        expect(contextToJSON(restored)).toEqual({
            userId: "user-1",
            personUserId: "person-1",
            agentId: "agent-1",
            durable: {
                active: true,
                kind: "local"
            }
        });
    });

    it("serializes and restores from a string", () => {
        const context = contexts.durable.set(
            contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" }),
            {
                active: true,
                kind: "inngest"
            }
        );

        const restored = Context.deserialize(contextSerialize(context));
        expect(restored.userId).toBe("user-1");
        expect(restored.personUserId).toBe("person-1");
        expect(restored.agentId).toBe("agent-1");
        expect(restored.durable).toEqual({
            active: true,
            kind: "inngest"
        });
    });

    it("stores typed values through namespaces", () => {
        const logNamespace = createContextNamespace<string>("log", "main");
        let context = logNamespace.set(emptyContext, "root");
        context = logNamespace.set(context, "request");

        expect(logNamespace.get(context)).toBe("request");
        expect(contextToJSON(context)).toEqual({
            log: "request"
        });
    });
});
