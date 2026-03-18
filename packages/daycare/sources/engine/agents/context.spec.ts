import { describe, expect, it } from "vitest";

import {
    Context,
    contextForAgent,
    contextForUser,
    contextNamespaceCreate,
    contextSerialize,
    contextToJSON
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
        const context = new Context({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" });
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
        const context = new Context({
            userId: "user-1",
            personUserId: "person-1",
            agentId: "agent-1",
            durable: {
                active: true,
                kind: "local"
            }
        });

        const restored = Context.fromJSON(contextToJSON(context));
        expect(restored.userId).toBe("user-1");
        expect(restored.personUserId).toBe("person-1");
        expect(restored.agentId).toBe("agent-1");
        expect(restored.durable).toEqual({
            active: true,
            kind: "local"
        });
    });

    it("serializes and restores from a string", () => {
        const traceNamespace = contextNamespaceCreate({
            id: "request.trace",
            defaultValue: {
                spanId: "span-default"
            }
        });
        const context = traceNamespace.set(
            contextForAgent({ userId: "user-1", personUserId: "person-1", agentId: "agent-1" }),
            {
                spanId: "span-1"
            }
        );

        const restored = Context.deserialize(contextSerialize(context));
        expect(restored.userId).toBe("user-1");
        expect(restored.personUserId).toBe("person-1");
        expect(restored.agentId).toBe("agent-1");
        expect(traceNamespace.get(restored)).toEqual({
            spanId: "span-1"
        });
    });

    it("keeps namespace extras immutable and isolated from built-in fields", () => {
        const localeNamespace = contextNamespaceCreate({
            id: "request.locale",
            defaultValue: "en"
        });
        const traceNamespace = contextNamespaceCreate({
            id: "request.trace",
            defaultValue: {
                flags: ["root"]
            }
        });

        const base = contextForUser({ userId: "user-1" });
        const localized = localeNamespace.set(base, "fr");
        const traced = traceNamespace.set(localized, {
            flags: ["child"]
        });

        expect(localeNamespace.get(base)).toBe("en");
        expect(localeNamespace.get(localized)).toBe("fr");
        expect(localeNamespace.get(traced)).toBe("fr");
        expect(traceNamespace.get(traced)).toEqual({
            flags: ["child"]
        });
        expect(contextToJSON(traced)).toEqual({
            userId: "user-1",
            namespaces: {
                "request.locale": "fr",
                "request.trace": {
                    flags: ["child"]
                }
            }
        });
    });
});
