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

    it("rejects durable calls when no runtime is active", async () => {
        await expect(
            contextForUser({ userId: "user-1" }).durableCall("job-1", "delayedSignalDeliver", {
                delayedSignalId: "job-1"
            })
        ).rejects.toThrow("Durable runtime is not bound to context.");
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

    it("keeps durable state runtime-only", () => {
        const context = contexts.durable.set(
            contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" }),
            {
                active: true,
                executionId: "job-1",
                instanceId: "local-1",
                kind: "local"
            }
        );

        const restored = Context.fromJSON(contextToJSON(context));
        expect(restored.userId).toBe("user-1");
        expect(restored.personUserId).toBe("person-1");
        expect(restored.agentId).toBe("agent-1");
        expect(restored.durable).toBeUndefined();
        expect(contextToJSON(restored)).toEqual({
            userId: "user-1",
            personUserId: "person-1",
            agentId: "agent-1"
        });
    });

    it("does not serialize durable state into strings", () => {
        const context = contexts.durable.set(
            contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" }),
            {
                active: true,
                executionId: "run-1",
                instanceId: "inngest-1",
                kind: "inngest"
            }
        );

        const restored = Context.deserialize(contextSerialize(context));
        expect(restored.userId).toBe("user-1");
        expect(restored.personUserId).toBe("person-1");
        expect(restored.agentId).toBe("agent-1");
        expect(restored.durable).toBeUndefined();
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

    it("supports non-serializable namespaces", () => {
        const runtimeNamespace = createContextNamespace<{ value: string } | null>("runtime", null, {
            serializable: false
        });
        const context = runtimeNamespace.set(emptyContext, { value: "live" });

        expect(runtimeNamespace.get(context)).toEqual({ value: "live" });
        expect(contextToJSON(context)).toEqual({});
        expect(Context.fromJSON(contextToJSON(context)).serialize()).toBe("{}");
    });
});
